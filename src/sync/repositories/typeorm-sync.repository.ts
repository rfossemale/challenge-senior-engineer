import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { TodoItem } from '../../todo_lists/entities/todo_item.entity';
import { TodoList } from '../../todo_lists/entities/todo_list.entity';
import type { SyncRepository } from './sync.repository';

/**
 * TypeORM-backed implementation of `SyncRepository`. All TypeORM/SQL
 * concerns live in this file; the rest of the sync module depends only on
 * the interface.
 */
@Injectable()
export class TypeormSyncRepository implements SyncRepository {
  private readonly listTable: string;
  private readonly itemTable: string;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(TodoList)
    private readonly listRepo: Repository<TodoList>,
    @InjectRepository(TodoItem)
    private readonly itemRepo: Repository<TodoItem>,
  ) {
    this.listTable = this.listRepo.metadata.tableName;
    this.itemTable = this.itemRepo.metadata.tableName;
  }

  // ---------- Push reads ----------

  findLocallyDeletedLists(): Promise<TodoList[]> {
    return this.listRepo.find({
      where: { deletedAt: Not(IsNull()), externalId: Not(IsNull()) },
      withDeleted: true,
    });
  }

  findNewLocalListsWithItems(): Promise<TodoList[]> {
    return this.listRepo.find({
      where: { externalId: IsNull() },
      relations: ['todoItems'],
    });
  }

  findDirtyLists(): Promise<TodoList[]> {
    return this.listRepo
      .createQueryBuilder('list')
      .where('list."externalId" IS NOT NULL')
      .andWhere('list."deletedAt" IS NULL')
      .andWhere(
        '(list."lastSyncAt" IS NULL OR list."updatedAt" > list."lastSyncAt")',
      )
      .getMany();
  }

  findLocallyDeletedItems(): Promise<TodoItem[]> {
    return this.itemRepo.find({
      where: { deletedAt: Not(IsNull()), externalId: Not(IsNull()) },
      relations: ['todoList'],
      withDeleted: true,
    });
  }

  findOrphanNewItems(): Promise<TodoItem[]> {
    return this.itemRepo
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.todoList', 'list')
      .where('item.externalId IS NULL')
      .andWhere('item.deletedAt IS NULL')
      .andWhere('list.externalId IS NOT NULL')
      .andWhere('list.deletedAt IS NULL')
      .getMany();
  }

  findDirtyItems(): Promise<TodoItem[]> {
    return this.itemRepo
      .createQueryBuilder('item')
      .innerJoinAndSelect('item.todoList', 'list')
      .where('item."externalId" IS NOT NULL')
      .andWhere('item."deletedAt" IS NULL')
      .andWhere('list."externalId" IS NOT NULL')
      .andWhere(
        '(item."lastSyncAt" IS NULL OR item."updatedAt" > item."lastSyncAt")',
      )
      .getMany();
  }

  // ---------- Pull reads ----------

  findListByExternalId(externalId: string): Promise<TodoList | null> {
    return this.listRepo.findOne({ where: { externalId } });
  }

  findItemByExternalId(
    externalId: string,
    todoListId: number,
  ): Promise<TodoItem | null> {
    return this.itemRepo.findOne({ where: { externalId, todoListId } });
  }

  // ---------- Push writes ----------

  async finalizeListRemoteCreate(input: {
    localListId: number;
    externalListId: string;
    items: Array<{ localItemId: number; externalItemId: string }>;
  }): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      await m.query(
        `UPDATE "${this.listTable}" SET "externalId" = $1, "lastSyncAt" = "updatedAt" WHERE id = $2`,
        [input.externalListId, input.localListId],
      );
      for (const it of input.items) {
        await m.query(
          `UPDATE "${this.itemTable}" SET "externalId" = $1, "lastSyncAt" = "updatedAt" WHERE id = $2`,
          [it.externalItemId, it.localItemId],
        );
      }
    });
  }

  async clearListExternalId(id: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE "${this.listTable}" SET "externalId" = NULL, "lastSyncAt" = "updatedAt" WHERE id = $1`,
      [id],
    );
  }

  async clearItemExternalId(id: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE "${this.itemTable}" SET "externalId" = NULL, "lastSyncAt" = "updatedAt" WHERE id = $1`,
      [id],
    );
  }

  async stampListSynced(id: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE "${this.listTable}" SET "lastSyncAt" = "updatedAt" WHERE id = $1`,
      [id],
    );
  }

  async stampItemSynced(id: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE "${this.itemTable}" SET "lastSyncAt" = "updatedAt" WHERE id = $1`,
      [id],
    );
  }

  // ---------- Pull writes ----------

  async createListFromRemote(input: {
    name: string;
    externalId: string;
  }): Promise<TodoList> {
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(TodoList);
      const created = repo.create({
        name: input.name,
        externalId: input.externalId,
        missingSyncCycles: 0,
      });
      const saved = await repo.save(created);
      await m.query(
        `UPDATE "${this.listTable}" SET "lastSyncAt" = "updatedAt" WHERE id = $1`,
        [saved.id],
      );
      return saved;
    });
  }

  async markListSynced(
    id: number,
    remotePatch?: { name: string },
  ): Promise<void> {
    if (!remotePatch) {
      // No field change — reset counter and stamp without touching updatedAt,
      // so the next dirty scan doesn't spuriously re-push this row.
      await this.dataSource.query(
        `UPDATE "${this.listTable}" SET "missingSyncCycles" = 0, "lastSyncAt" = "updatedAt" WHERE id = $1`,
        [id],
      );
      return;
    }
    // LWW said remote wins: apply the payload, bump updatedAt to NOW(), and
    // stamp lastSyncAt to the same NOW() — one atomic UPDATE.
    await this.dataSource.query(
      `UPDATE "${this.listTable}" SET "name" = $2, "missingSyncCycles" = 0, "updatedAt" = NOW(), "lastSyncAt" = NOW() WHERE id = $1`,
      [id, remotePatch.name],
    );
  }

  async createItemFromRemote(input: {
    description: string;
    completed: boolean;
    todoListId: number;
    externalId: string;
  }): Promise<TodoItem> {
    return this.dataSource.transaction(async (m) => {
      const repo = m.getRepository(TodoItem);
      const created = repo.create({
        description: input.description,
        completed: input.completed,
        todoListId: input.todoListId,
        externalId: input.externalId,
        missingSyncCycles: 0,
      });
      const saved = await repo.save(created);
      await m.query(
        `UPDATE "${this.itemTable}" SET "lastSyncAt" = "updatedAt" WHERE id = $1`,
        [saved.id],
      );
      return saved;
    });
  }

  async markItemSynced(
    id: number,
    remotePatch?: { description: string; completed: boolean },
  ): Promise<void> {
    if (!remotePatch) {
      await this.dataSource.query(
        `UPDATE "${this.itemTable}" SET "missingSyncCycles" = 0, "lastSyncAt" = "updatedAt" WHERE id = $1`,
        [id],
      );
      return;
    }
    await this.dataSource.query(
      `UPDATE "${this.itemTable}" SET "description" = $2, "completed" = $3, "missingSyncCycles" = 0, "updatedAt" = NOW(), "lastSyncAt" = NOW() WHERE id = $1`,
      [id, remotePatch.description, remotePatch.completed],
    );
  }

  // ---------- Grace-period sweep ----------

  async bumpMissingLists(seenExternalIds: string[]): Promise<void> {
    const qb = this.listRepo
      .createQueryBuilder()
      .update(TodoList)
      // Override updatedAt to itself so TypeORM's @UpdateDateColumn auto-touch
      // doesn't fire — otherwise the row would look dirty next cycle.
      .set({
        missingSyncCycles: () => `"missingSyncCycles" + 1`,
        updatedAt: () => `"updatedAt"`,
      })
      .where(`"externalId" IS NOT NULL`)
      .andWhere(`"deletedAt" IS NULL`);
    if (seenExternalIds.length > 0) {
      qb.andWhere(`"externalId" NOT IN (:...seen)`, { seen: seenExternalIds });
    }
    await qb.execute();
  }

  async softDeleteListsAtThreshold(graceCycles: number): Promise<number> {
    const result = await this.listRepo
      .createQueryBuilder()
      .softDelete()
      .where(`"externalId" IS NOT NULL`)
      .andWhere(`"deletedAt" IS NULL`)
      .andWhere(`"missingSyncCycles" >= :grace`, { grace: graceCycles })
      .execute();
    return result.affected ?? 0;
  }

  async bumpMissingItems(seenExternalIds: string[]): Promise<void> {
    const qb = this.itemRepo
      .createQueryBuilder()
      .update(TodoItem)
      .set({
        missingSyncCycles: () => `"missingSyncCycles" + 1`,
        updatedAt: () => `"updatedAt"`,
      })
      .where(`"externalId" IS NOT NULL`)
      .andWhere(`"deletedAt" IS NULL`);
    if (seenExternalIds.length > 0) {
      qb.andWhere(`"externalId" NOT IN (:...seen)`, { seen: seenExternalIds });
    }
    await qb.execute();
  }

  async softDeleteItemsAtThreshold(graceCycles: number): Promise<number> {
    const result = await this.itemRepo
      .createQueryBuilder()
      .softDelete()
      .where(`"externalId" IS NOT NULL`)
      .andWhere(`"deletedAt" IS NULL`)
      .andWhere(`"missingSyncCycles" >= :grace`, { grace: graceCycles })
      .execute();
    return result.affected ?? 0;
  }
}
