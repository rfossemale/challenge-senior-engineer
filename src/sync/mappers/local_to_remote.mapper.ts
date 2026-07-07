import type { TodoList } from '../../todo_lists/entities/todo_list.entity';
import type { TodoItem } from '../../todo_lists/entities/todo_item.entity';
import type {
  CreateRemoteTodoListBody,
  CreateRemoteTodoItemBody,
  UpdateRemoteTodoListBody,
  UpdateRemoteTodoItemBody,
} from '../interfaces';

/**
 * `source_id` we send to the remote for every record we push. Format
 * `<instance>:<kind>:<localId>` is deterministic + globally unique per
 * instance, so a retried POST is idempotent (remote enforces uniqueness on
 * source_id, per the contract confirmation) and the pull can tell "this
 * came from me" from "this came from elsewhere".
 */
export function buildSourceId(
  instanceId: string,
  kind: 'list' | 'item',
  localId: number,
): string {
  return `${instanceId}:${kind}:${localId}`;
}

export function toCreateListBody(
  local: TodoList,
  instanceId: string,
): CreateRemoteTodoListBody {
  return {
    source_id: buildSourceId(instanceId, 'list', local.id),
    name: local.name,
    items: (local.todoItems ?? []).map((it) =>
      toCreateItemBody(it, instanceId),
    ),
  };
}

export function toUpdateListBody(local: TodoList): UpdateRemoteTodoListBody {
  return { name: local.name };
}

export function toCreateItemBody(
  local: TodoItem,
  instanceId: string,
): CreateRemoteTodoItemBody {
  return {
    source_id: buildSourceId(instanceId, 'item', local.id),
    description: local.description,
    completed: local.completed,
  };
}

export function toUpdateItemBody(local: TodoItem): UpdateRemoteTodoItemBody {
  return {
    description: local.description,
    completed: local.completed,
  };
}
