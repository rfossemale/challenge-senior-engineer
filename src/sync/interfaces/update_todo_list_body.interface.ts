/**
 * Body for `PATCH /todolists/{todolistId}` on the external Todo API.
 * See `docs/docs/external-api.yaml` (`components.schemas.UpdateTodoListBody`).
 *
 * The remote only accepts `name` on list updates — item changes must be
 * routed through the item endpoints.
 */
export interface UpdateRemoteTodoListBody {
  name?: string;
}
