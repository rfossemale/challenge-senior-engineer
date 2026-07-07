import type { TodoItem } from '../todo_lists/entities/todo_item.entity';
import type { TodoList } from '../todo_lists/entities/todo_list.entity';
import {
  buildSourceId,
  extractRemoteItemFields,
  extractRemoteListFields,
  remoteIsNewer,
  toCreateItemBody,
  toCreateListBody,
  toUpdateItemBody,
  toUpdateListBody,
} from '../sync/mappers';

const INSTANCE = 'inst-a';

function makeList(overrides: Partial<TodoList> = {}): TodoList {
  return {
    id: 7,
    name: 'Groceries',
    externalId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    lastSyncAt: null,
    missingSyncCycles: 0,
    deletedAt: null,
    todoItems: [],
    ...overrides,
  } as TodoList;
}

function makeItem(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 3,
    description: 'buy milk',
    completed: false,
    todoListId: 7,
    todoList: undefined as unknown as TodoList,
    externalId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    lastSyncAt: null,
    missingSyncCycles: 0,
    deletedAt: null,
    ...overrides,
  } as TodoItem;
}

describe('sync mappers', () => {
  describe('buildSourceId', () => {
    it('produces a deterministic <instance>:<kind>:<id> string', () => {
      expect(buildSourceId(INSTANCE, 'list', 42)).toBe('inst-a:list:42');
      expect(buildSourceId(INSTANCE, 'item', 3)).toBe('inst-a:item:3');
    });
  });

  describe('toCreateListBody', () => {
    it('includes source_id, name and nested items', () => {
      const list = makeList({
        todoItems: [makeItem({ id: 1, description: 'a' })],
      });
      const body = toCreateListBody(list, INSTANCE);
      expect(body).toEqual({
        source_id: 'inst-a:list:7',
        name: 'Groceries',
        items: [
          {
            source_id: 'inst-a:item:1',
            description: 'a',
            completed: false,
          },
        ],
      });
    });

    it('emits an empty items array when the list has none', () => {
      const list = makeList({ todoItems: [] });
      expect(toCreateListBody(list, INSTANCE).items).toEqual([]);
    });
  });

  describe('toUpdateListBody', () => {
    it('sends only the name (contract does not accept anything else)', () => {
      expect(toUpdateListBody(makeList({ name: 'Renamed' }))).toEqual({
        name: 'Renamed',
      });
    });
  });

  describe('toCreateItemBody / toUpdateItemBody', () => {
    it('creates with source_id and updates without it', () => {
      const it = makeItem({ description: 'x', completed: true });
      expect(toCreateItemBody(it, INSTANCE)).toEqual({
        source_id: 'inst-a:item:3',
        description: 'x',
        completed: true,
      });
      expect(toUpdateItemBody(it)).toEqual({
        description: 'x',
        completed: true,
      });
    });
  });

  describe('remoteIsNewer', () => {
    const local = new Date('2026-01-02T00:00:00Z');
    it('returns true when the remote ISO is strictly newer', () => {
      expect(remoteIsNewer('2026-01-03T00:00:00Z', local)).toBe(true);
    });
    it('returns false when the remote is equal or older', () => {
      expect(remoteIsNewer('2026-01-02T00:00:00Z', local)).toBe(false);
      expect(remoteIsNewer('2026-01-01T00:00:00Z', local)).toBe(false);
    });
    it('is defensive against missing or invalid timestamps', () => {
      expect(remoteIsNewer(undefined, local)).toBe(false);
      expect(remoteIsNewer('not-a-date', local)).toBe(false);
    });
  });

  describe('extractRemoteListFields / extractRemoteItemFields', () => {
    it('falls back to the local value when remote fields are absent', () => {
      expect(
        extractRemoteListFields({ id: 'x' }, { name: 'local-name' }),
      ).toEqual({ name: 'local-name' });
      expect(
        extractRemoteItemFields(
          { id: 'x' },
          { description: 'local-desc', completed: true },
        ),
      ).toEqual({ description: 'local-desc', completed: true });
    });

    it('uses the remote value when present (including completed=false)', () => {
      expect(
        extractRemoteItemFields(
          { id: 'x', description: 'remote-desc', completed: false },
          { description: 'local-desc', completed: true },
        ),
      ).toEqual({ description: 'remote-desc', completed: false });
    });
  });
});
