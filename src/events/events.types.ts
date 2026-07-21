import { TodoList } from '../todo_lists/entities/todo_list.entity';
import { TodoItem } from '../todo_lists/entities/todo_item.entity';

export const CHANGE_EVENT = 'entity.changed';

export type ChangeOperation = 'created' | 'updated' | 'deleted';
export type ChangeEntity = 'list' | 'item' | 'items';

interface BaseChangeEvent {
  operation: ChangeOperation;
  emittedAt: string;
}

export type ChangeEvent =
  | (BaseChangeEvent & { entity: 'list'; resource: TodoList })
  | (BaseChangeEvent & { entity: 'item'; resource: TodoItem })
  | (BaseChangeEvent & { entity: 'items'; resource: TodoItem[] });
