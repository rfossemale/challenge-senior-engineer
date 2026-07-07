/**
 * Body for `POST /todolists` on the external Todo API.
 * See `docs/docs/external-api.yaml` (`components.schemas.CreateTodoListBody`).
 *
 * `source_id` is our idempotency / origin marker — send our own instance id
 * so the pull step can tell "this record was pushed by me" vs "this came
 * from another origin", which prevents echo loops in bi-directional sync.
 */
import type { CreateRemoteTodoItemBody } from './create_todo_item_body.interface';

export interface CreateRemoteTodoListBody {
  source_id?: string;
  name?: string;
  items?: CreateRemoteTodoItemBody[];
}
