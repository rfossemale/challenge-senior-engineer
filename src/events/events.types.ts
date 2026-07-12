import { TodoList } from '../todo_lists/entities/todo_list.entity';
import { TodoItem } from '../todo_lists/entities/todo_item.entity';

export const CHANGE_EVENT = 'entity.changed';

export type ChangeOperation = 'created' | 'updated' | 'deleted';
export type ChangeEntity = 'list' | 'item';

export interface ChangeEvent {
  entity: ChangeEntity;
  operation: ChangeOperation;
  resource: TodoList | TodoItem;
  emittedAt: string;
}
