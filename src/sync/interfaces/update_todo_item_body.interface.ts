/**
 * Body for `PATCH /todolists/{todolistId}/todoitems/{todoitemId}` on the
 * external Todo API.
 * See `docs/docs/external-api.yaml` (`components.schemas.UpdateTodoItemBody`).
 */
export interface UpdateRemoteTodoItemBody {
  description?: string;
  completed?: boolean;
}
