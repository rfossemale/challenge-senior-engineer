/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CHANGE_EVENT, ChangeEvent, ChangeOperation } from './events.types';

import { TodoList } from '../todo_lists/entities/todo_list.entity';
import { TodoItem } from '../todo_lists/entities/todo_item.entity';

@Injectable()
export class ChangePublisher {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publishListChange(operation: ChangeOperation, list: TodoList): void {
    this.emit({
      entity: 'list',
      operation,
      resource: list,
      emittedAt: new Date().toISOString(),
    });
  }

  publishItemChange(operation: ChangeOperation, item: TodoItem): void {
    this.emit({
      entity: 'item',
      operation,
      resource: item,
      emittedAt: new Date().toISOString(),
    });
  }

  publishItemsChange(operation: ChangeOperation, items: TodoItem[]): void {
    this.emit({
      entity: 'items',
      operation,
      resource: items,
      emittedAt: new Date().toISOString(),
    });
  }

  private emit(event: ChangeEvent): void {
    this.eventEmitter.emit(CHANGE_EVENT, event);
  }
}
