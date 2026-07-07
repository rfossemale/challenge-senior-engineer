import type { TodoItem } from '../../todo_lists/entities/todo_item.entity';
import type { TodoList } from '../../todo_lists/entities/todo_list.entity';

export const SYNC_REPOSITORY = Symbol('SYNC_REPOSITORY');

/**
 * Domain-facing data access for the sync module. Hides all TypeORM/SQL
 * concerns from `SyncService` — the service depends on this interface only,
 * never on `Repository<T>`, `QueryBuilder`, `DataSource`, or raw SQL.
 *
 * Atomicity contract: every method below is atomic. Methods that combine
 * multiple statements (create-then-stamp, backfill-list-and-its-items) run
 * inside a DB transaction and roll back cleanly on failure — a partial
 * failure of the local writes will never leave a record in a half-synced
 * state (e.g. externalId set but lastSyncAt not stamped).
 *
 * Note: this cannot rescue the *dual-write* case where the remote call
 * succeeded and the subsequent local write failed. That's the classic
 * remote-then-local inconsistency (outbox-pattern territory) and is out of
 * scope for this interface.
 */
export interface SyncRepository {
  // ---------- Push reads ----------

  /** Soft-deleted local lists that were once synced. */
  findLocallyDeletedLists(): Promise<TodoList[]>;

  /** Brand-new local lists (never synced) with their items eagerly loaded. */
  findNewLocalListsWithItems(): Promise<TodoList[]>;

  /**
   * Already-synced lists whose `updatedAt` moved past `lastSyncAt`.
   * Filter is pushed to SQL and matches `idx_todo_list_dirty`.
   */
  findDirtyLists(): Promise<TodoList[]>;

  /** Soft-deleted local items that were once synced (with `todoList` loaded). */
  findLocallyDeletedItems(): Promise<TodoItem[]>;

  /**
   * New local items on already-remote lists — cannot be pushed today (the
   * external API lacks `POST /todolists/{id}/todoitems`). Caller logs and
   * skips.
   */
  findOrphanNewItems(): Promise<TodoItem[]>;

  /** Already-synced items whose `updatedAt` moved past `lastSyncAt`. */
  findDirtyItems(): Promise<TodoItem[]>;

  // ---------- Pull reads ----------

  findListByExternalId(externalId: string): Promise<TodoList | null>;
  findItemByExternalId(
    externalId: string,
    todoListId: number,
  ): Promise<TodoItem | null>;

  // ---------- Push writes ----------

  /**
   * After a successful `POST /todolists`, records the returned identifiers
   * onto the local list AND each of its nested items — all inside a single
   * transaction. Also stamps `lastSyncAt = updatedAt` for every affected row.
   */
  finalizeListRemoteCreate(input: {
    localListId: number;
    externalListId: string;
    items: Array<{ localItemId: number; externalItemId: string }>;
  }): Promise<void>;

  /**
   * After a successful remote DELETE: clear `externalId` and stamp
   * `lastSyncAt = updatedAt` in a single UPDATE.
   */
  clearListExternalId(id: number): Promise<void>;
  clearItemExternalId(id: number): Promise<void>;

  /** After a successful remote PATCH: stamp `lastSyncAt = updatedAt`. */
  stampListSynced(id: number): Promise<void>;
  stampItemSynced(id: number): Promise<void>;

  // ---------- Pull writes ----------

  /**
   * Insert a local list mirroring a remote one, stamping `lastSyncAt` in
   * the same transaction. Returns the inserted row (needed to link items).
   */
  createListFromRemote(input: {
    name: string;
    externalId: string;
  }): Promise<TodoList>;

  /**
   * Called after we've seen a remote list in a pull. If `remotePatch` is
   * present, LWW said remote wins and we apply the payload; otherwise we
   * only reset `missingSyncCycles` and refresh `lastSyncAt` without
   * touching `updatedAt` (avoids marking the row as dirty on the next
   * push scan).
   */
  markListSynced(id: number, remotePatch?: { name: string }): Promise<void>;

  createItemFromRemote(input: {
    description: string;
    completed: boolean;
    todoListId: number;
    externalId: string;
  }): Promise<TodoItem>;

  markItemSynced(
    id: number,
    remotePatch?: { description: string; completed: boolean },
  ): Promise<void>;

  // ---------- Grace-period sweep (two bulk UPDATEs per entity) ----------

  bumpMissingLists(seenExternalIds: string[]): Promise<void>;
  softDeleteListsAtThreshold(graceCycles: number): Promise<number>;
  bumpMissingItems(seenExternalIds: string[]): Promise<void>;
  softDeleteItemsAtThreshold(graceCycles: number): Promise<number>;
}
