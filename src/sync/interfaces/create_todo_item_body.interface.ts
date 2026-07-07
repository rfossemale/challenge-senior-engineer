/**
 * Body for creating a `TodoItem` on the external Todo API — used only
 * nested inside `CreateRemoteTodoListBody.items[]`. The external contract
 * does NOT expose a standalone `POST /todolists/{id}/todoitems` endpoint;
 * new items on an existing list have to be pushed via a full list update
 * or list re-create per the current spec.
 * See `docs/docs/external-api.yaml` (`components.schemas.CreateTodoItemBody`).
 */
export interface CreateRemoteTodoItemBody {
  source_id?: string;
  description?: string;
  completed?: boolean;
}
