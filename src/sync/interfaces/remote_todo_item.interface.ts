/**
 * Mirrors `TodoItem` in the external Todo API contract.
 * See `docs/docs/external-api.yaml` (`components.schemas.TodoItem`).
 *
 * Note: the remote `TodoItem` has NO `todolist_id` field — items are only
 * ever exposed nested inside a `RemoteTodoList.items[]` or addressed via
 * the path `/todolists/{todolistId}/todoitems/{todoitemId}`.
 */
export interface RemoteTodoItem {
  id?: string;
  source_id?: string;
  description?: string;
  completed?: boolean;
  created_at?: string;
  updated_at?: string;
}
