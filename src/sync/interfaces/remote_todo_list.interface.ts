/**
 * Mirrors `TodoList` in the external Todo API contract.
 * See `docs/docs/external-api.yaml` (`components.schemas.TodoList`).
 *
 * Property names use `snake_case` because they come straight off the wire —
 * do NOT convert here; leave that to a mapper layer.
 * `id` is a string (the remote uses opaque IDs), unlike the local numeric id.
 * `created_at` / `updated_at` are ISO-8601 date-time strings as received;
 * parse to `Date` only when needed.
 * Every field is optional per the spec — validate at the boundary before use.
 */
import type { RemoteTodoItem } from './remote_todo_item.interface';

export interface RemoteTodoList {
  id?: string;
  source_id?: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
  items?: RemoteTodoItem[];
}
