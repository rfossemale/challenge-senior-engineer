import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExternalTodoApiClient } from '../clients/external_todo_api.client';
import type { RemoteTodoItem, RemoteTodoList } from '../interfaces';
import {
  buildSourceId,
  extractRemoteItemFields,
  extractRemoteListFields,
  remoteIsNewer,
  toCreateListBody,
  toUpdateItemBody,
  toUpdateListBody,
} from '../mappers';
import {
  SYNC_REPOSITORY,
  type SyncRepository,
} from '../repositories/sync.repository';
import { runBounded } from '../util/concurrency';
import { SyncLockService } from './sync_lock.service';
import { ChangePublisher } from '../../events/events.publisher';

// Reports are exported as classes (not interfaces) so `@nestjs/swagger`
// can pick them up as response schemas. As TypeScript types they behave
// identically to the previous interfaces — callers don't need changes.

export class PushReport {
  @ApiProperty({ description: 'Lists created on the remote this cycle.' })
  createdLists: number;
  @ApiProperty({ description: 'Lists patched on the remote this cycle.' })
  updatedLists: number;
  @ApiProperty({ description: 'Lists deleted on the remote this cycle.' })
  deletedLists: number;
  @ApiProperty({ description: 'Items patched on the remote this cycle.' })
  updatedItems: number;
  @ApiProperty({ description: 'Items deleted on the remote this cycle.' })
  deletedItems: number;
  @ApiProperty({
    description:
      'New local items on already-remote lists that could not be pushed because the external API has no POST /todolists/:id/todoitems endpoint yet.',
  })
  skippedNewItems: number;
  @ApiProperty({
    type: [String],
    description: 'Per-record error messages (non-fatal; cycle continues).',
  })
  errors: string[];
}

export class PullReport {
  @ApiProperty({ description: 'New local lists created from remote state.' })
  createdLists: number;
  @ApiProperty({ description: 'Existing local lists reconciled from remote.' })
  updatedLists: number;
  @ApiProperty({ description: 'New local items created from remote state.' })
  createdItems: number;
  @ApiProperty({ description: 'Existing local items reconciled from remote.' })
  updatedItems: number;
  @ApiProperty({
    description:
      'Local lists soft-deleted because they exceeded SYNC_DELETE_GRACE_CYCLES consecutive absences from the remote.',
  })
  softDeletedLists: number;
  @ApiProperty({ description: 'Local items soft-deleted for the same reason.' })
  softDeletedItems: number;
  @ApiProperty({
    type: [String],
    description: 'Per-record error messages (non-fatal; cycle continues).',
  })
  errors: string[];
}

export class SyncReport {
  @ApiProperty({
    example: false,
    description:
      'True when another cycle was already running and the advisory lock was busy. When true, no push/pull work was performed.',
  })
  skipped: boolean;
  @ApiPropertyOptional({
    example: 'lock-busy',
    description: 'Reason for skipping, when `skipped` is true.',
  })
  reason?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  startedAt?: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  finishedAt?: string;
  @ApiPropertyOptional({ type: () => PushReport })
  push?: PushReport;
  @ApiPropertyOptional({ type: () => PullReport })
  pull?: PullReport;
}

/**
 * Bi-directional sync orchestrator. One cycle = acquire lock → push local
 * changes to remote → pull remote state and reconcile locally → release lock.
 *
 * Key invariants:
 * - Push runs BEFORE pull (ajuste #1): otherwise a local edit made between
 *   the pull and its subsequent push would be silently overwritten.
 * - Conflict resolution is Last-Write-Wins by `updated_at` (ajuste #2). No
 *   field-level merge — accepted trade-off.
 * - Deletes use a grace period (ajuste #3): a remote record absent from
 *   the pull is not deleted locally until it's been missing for
 *   `SYNC_DELETE_GRACE_CYCLES` consecutive cycles.
 * - Single cycle at a time via Postgres advisory lock (ajuste #4).
 * - Idempotent: every remote write is keyed by `source_id`; local success
 *   is recorded atomically by the repository (ajuste #5).
 *
 * Data access:
 * - All persistence lives behind `SyncRepository` (injected via the
 *   `SYNC_REPOSITORY` token). This class contains NO TypeORM or SQL.
 * - Multi-statement local writes (create-then-stamp, list-plus-nested-items
 *   backfill) are wrapped in DB transactions inside the repository, so a
 *   partial failure of the local writes never leaves a record in a
 *   half-synced state.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly instanceId: string;
  private readonly graceCycles: number;
  private readonly pushConcurrency: number;

  constructor(
    @Inject(SYNC_REPOSITORY) private readonly syncRepo: SyncRepository,
    private readonly client: ExternalTodoApiClient,
    private readonly lock: SyncLockService,
    private readonly changePublisher: ChangePublisher,
    config: ConfigService,
  ) {
    this.instanceId = config.get<string>('SYNC_SOURCE_ID', 'local-dev');
    this.graceCycles = Number(
      config.get<string>('SYNC_DELETE_GRACE_CYCLES', '2'),
    );
    // Caps how many remote HTTP calls the push phase has in flight at once.
    // Prevents 429s from the external API when a cycle has to process many
    // records. Same value re-used across all sections that use runBounded.
    this.pushConcurrency = Math.max(
      1,
      Number(config.get<string>('SYNC_PUSH_CONCURRENCY', '8')),
    );
  }

  async test(): Promise<RemoteTodoItem[]> {
    try {
      return this.client.listTodoLists();
    } catch (err) {
      throw new Error(`Sync test failed: ${(err as Error).message}`);
    }
  }

  async run(): Promise<SyncReport> {
    const acquired = await this.lock.tryAcquire();
    if (!acquired) {
      this.logger.log('Sync skipped: another cycle is running.');
      return { skipped: true, reason: 'lock-busy' };
    }
    const startedAt = new Date();
    try {
      const push = await this.pushLocalToRemote();
      const pull = await this.pullRemoteToLocal();
      return {
        skipped: false,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        push,
        pull,
      };
    } finally {
      await this.lock.release();
    }
  }

  private async pushLocalToRemote(): Promise<PushReport> {
    const report: PushReport = {
      createdLists: 0,
      updatedLists: 0,
      deletedLists: 0,
      updatedItems: 0,
      deletedItems: 0,
      skippedNewItems: 0,
      errors: [],
    };

    // 1. Locally soft-deleted lists that were ever synced → delete remote.
    //    Bounded concurrency: at most `pushConcurrency` HTTP calls in flight
    //    at once (avoids 429 from the external API on large batches).
    //    Errors are caught by runBounded and forwarded to onError, which
    //    records them in the report and emits a warn log.
    const softDeletedLists = await this.syncRepo.findLocallyDeletedLists();
    await runBounded(
      softDeletedLists,
      this.pushConcurrency,
      async (local) => {
        await this.client.deleteTodoList(local.externalId!);
        await this.syncRepo.clearListExternalId(local.id);
        report.deletedLists++;
      },
      (err, local) => {
        const msg = err instanceof Error ? err.message : String(err);
        report.errors.push(`delete list ${local.id}: ${msg}`);
        this.logger.warn(`delete list ${local.id} failed: ${msg}`);
      },
    );

    // 2. Brand-new local lists (never synced) → create remotely with items.
    for (const local of await this.syncRepo.findNewLocalListsWithItems()) {
      try {
        const remote = await this.client.createTodoList(
          toCreateListBody(local, this.instanceId),
        );
        if (!remote.id) {
          report.errors.push(`create list ${local.id}: remote returned no id`);
          continue;
        }
        const itemBackfills: Array<{
          localItemId: number;
          externalItemId: string;
        }> = [];
        for (const localItem of local.todoItems ?? []) {
          const expected = buildSourceId(this.instanceId, 'item', localItem.id);
          const match = remote.items?.find((r) => r.source_id === expected);
          if (match?.id) {
            itemBackfills.push({
              localItemId: localItem.id,
              externalItemId: match.id,
            });
          }
        }
        // Single transaction: externalId back-fill + stamp for the list and
        // every matched item. All-or-nothing.
        await this.syncRepo.finalizeListRemoteCreate({
          localListId: local.id,
          externalListId: remote.id,
          items: itemBackfills,
        });
        report.createdLists++;
      } catch (err) {
        report.errors.push(
          `create list ${local.id}: ${(err as Error).message}`,
        );
      }
    }

    // 3. Already-synced lists with local edits since last sync.
    for (const local of await this.syncRepo.findDirtyLists()) {
      try {
        await this.client.updateTodoList(
          local.externalId!,
          toUpdateListBody(local),
        );
        await this.syncRepo.stampListSynced(local.id);
        report.updatedLists++;
      } catch (err) {
        report.errors.push(
          `update list ${local.id}: ${(err as Error).message}`,
        );
      }
    }

    // 4. Locally soft-deleted items that were ever synced → delete remote.
    for (const local of await this.syncRepo.findLocallyDeletedItems()) {
      const listExternalId = local.todoList?.externalId;
      if (!listExternalId) continue;
      try {
        await this.client.deleteTodoItem(listExternalId, local.externalId!);
        await this.syncRepo.clearItemExternalId(local.id);
        report.deletedItems++;
      } catch (err) {
        report.errors.push(
          `delete item ${local.id}: ${(err as Error).message}`,
        );
      }
    }

    // 5. Contract gap: new local items on already-remote lists cannot be
    //    pushed (external API has no POST /todolists/{id}/todoitems).
    //    Skip + warn per user decision. They stay with externalId=null and
    //    will be retried automatically once the endpoint exists.
    for (const it of await this.syncRepo.findOrphanNewItems()) {
      this.logger.warn(
        `Cannot push new local item id=${it.id} on already-remote list externalId=${it.todoList.externalId}: external API has no POST /todolists/{id}/todoitems endpoint. Skipping.`,
      );
      report.skippedNewItems++;
    }

    // 6. Already-synced items with local edits since last sync.
    for (const local of await this.syncRepo.findDirtyItems()) {
      const listExternalId = local.todoList?.externalId;
      if (!listExternalId) continue;
      try {
        await this.client.updateTodoItem(
          listExternalId,
          local.externalId!,
          toUpdateItemBody(local),
        );
        await this.syncRepo.stampItemSynced(local.id);
        report.updatedItems++;
      } catch (err) {
        report.errors.push(
          `update item ${local.id}: ${(err as Error).message}`,
        );
      }
    }

    return report;
  }

  private async pullRemoteToLocal(): Promise<PullReport> {
    const report: PullReport = {
      createdLists: 0,
      updatedLists: 0,
      createdItems: 0,
      updatedItems: 0,
      softDeletedLists: 0,
      softDeletedItems: 0,
      errors: [],
    };

    const remotes = await this.client.listTodoLists();
    const seenListExternalIds = new Set<string>();
    const seenItemExternalIds = new Set<string>();

    for (const remote of remotes) {
      if (!remote.id) continue;
      seenListExternalIds.add(remote.id);
      try {
        await this.reconcileList(remote, seenItemExternalIds, report);
      } catch (err) {
        report.errors.push(
          `reconcile list ${remote.id}: ${(err as Error).message}`,
        );
      }
    }

    await this.syncRepo.bumpMissingLists(Array.from(seenListExternalIds));
    report.softDeletedLists = await this.syncRepo.softDeleteListsAtThreshold(
      this.graceCycles,
    );
    await this.syncRepo.bumpMissingItems(Array.from(seenItemExternalIds));
    report.softDeletedItems = await this.syncRepo.softDeleteItemsAtThreshold(
      this.graceCycles,
    );
    // TODO: emit 'deleted' change events for the rows soft-deleted above.
    // The current SyncRepository contract returns only a count from the
    // threshold sweeps — we'd need it to return the affected entities (or
    // add a separate lookup) before we can broadcast per-row events. Left
    // out on purpose so the pull path keeps a single bulk UPDATE per phase.

    return report;
  }

  private async reconcileList(
    remote: RemoteTodoList,
    seenItemExternalIds: Set<string>,
    report: PullReport,
  ): Promise<void> {
    if (!remote.id) return;
    const existing = await this.syncRepo.findListByExternalId(remote.id);

    let localListId: number;
    if (!existing) {
      const created = await this.syncRepo.createListFromRemote({
        name: remote.name ?? '',
        externalId: remote.id,
      });
      localListId = created.id;
      report.createdLists++;
      this.changePublisher.publishListChange('created', created);
    } else {
      localListId = existing.id;
      if (remoteIsNewer(remote.updated_at, existing.updatedAt)) {
        const fields = extractRemoteListFields(remote, { name: existing.name });
        await this.syncRepo.markListSynced(existing.id, { name: fields.name });
        report.updatedLists++;
        // Publish the merged in-memory state — the write above is atomic,
        // and re-fetching would add one query per reconciled row per cycle.
        this.changePublisher.publishListChange('updated', {
          ...existing,
          name: fields.name,
        });
      } else {
        await this.syncRepo.markListSynced(existing.id);
      }
    }

    for (const rit of remote.items ?? []) {
      if (!rit.id) continue;
      seenItemExternalIds.add(rit.id);
      await this.reconcileItem(rit, localListId, report);
    }
  }

  private async reconcileItem(
    remote: RemoteTodoItem,
    localListId: number,
    report: PullReport,
  ): Promise<void> {
    if (!remote.id) return;
    const existing = await this.syncRepo.findItemByExternalId(
      remote.id,
      localListId,
    );

    if (!existing) {
      await this.syncRepo.createItemFromRemote({
        description: remote.description ?? '',
        completed: remote.completed ?? false,
        todoListId: localListId,
        externalId: remote.id,
      });
      report.createdItems++;
      // Re-fetch to publish the fully materialized row (id, timestamps, …).
      const created = await this.syncRepo.findItemByExternalId(
        remote.id,
        localListId,
      );
      if (created) {
        this.changePublisher.publishItemChange('created', created);
      }
      return;
    }

    if (remoteIsNewer(remote.updated_at, existing.updatedAt)) {
      const fields = extractRemoteItemFields(remote, {
        description: existing.description,
        completed: existing.completed,
      });
      await this.syncRepo.markItemSynced(existing.id, {
        description: fields.description,
        completed: fields.completed,
      });
      report.updatedItems++;
      // Publish the merged in-memory state (see the analogous list branch).
      this.changePublisher.publishItemChange('updated', {
        ...existing,
        description: fields.description,
        completed: fields.completed,
      });
    } else {
      await this.syncRepo.markItemSynced(existing.id);
    }
  }
}
