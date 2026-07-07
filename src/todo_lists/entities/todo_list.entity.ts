import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { TodoItem } from './todo_item.entity';

@Entity()
// Partial index that matches the exact predicate used by SyncService's
// "dirty push" scan — Postgres uses it to avoid scanning fresh/unsynced rows.
@Index('idx_todo_list_dirty', ['updatedAt'], {
  where:
    '"externalId" IS NOT NULL AND "deletedAt" IS NULL AND ("lastSyncAt" IS NULL OR "updatedAt" > "lastSyncAt")',
})
export class TodoList {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  externalId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'int', default: 0 })
  missingSyncCycles: number;

  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(() => TodoItem, (todoItem) => todoItem.todoList)
  todoItems: TodoItem[];
}
