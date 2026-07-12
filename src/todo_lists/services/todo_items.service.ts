import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTodoItemDto } from '../dtos/create-todo_item';
import { UpdateTodoItemDto } from '../dtos/update-todo_item';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TodoItem } from '../entities/todo_item.entity';
import { ChangePublisher } from '../../events/events.publisher';

@Injectable()
export class TodoItemsService {
  constructor(
    @InjectRepository(TodoItem)
    private readonly todoItemRepository: Repository<TodoItem>,
    private readonly changePublisher: ChangePublisher,
  ) {}

  async all(todoListId: number): Promise<TodoItem[]> {
    return await this.todoItemRepository.find({ where: { todoListId } });
  }

  async get(todoListId: number, id: number): Promise<TodoItem | null> {
    return await this.todoItemRepository.findOneBy({ id, todoListId });
  }

  async create(todoListId: number, dto: CreateTodoItemDto): Promise<TodoItem> {
    const todoItem = this.todoItemRepository.create({
      description: dto.description,
      completed: dto.completed ?? false,
      todoListId,
    });
    const saved = await this.todoItemRepository.save(todoItem);
    this.changePublisher.publishItemChange('created', saved);
    return saved;
  }

  async update(
    todoListId: number,
    id: number,
    dto: UpdateTodoItemDto,
  ): Promise<TodoItem> {
    const existing = await this.todoItemRepository.findOneBy({
      id,
      todoListId,
    });
    if (!existing) {
      throw new NotFoundException(
        `TodoItem with id ${id} not found in TodoList with id ${todoListId}`,
      );
    }
    const merged = this.todoItemRepository.merge(existing, dto);
    const saved = await this.todoItemRepository.save(merged);
    this.changePublisher.publishItemChange('updated', saved);
    return saved;
  }

  async delete(todoListId: number, id: number): Promise<void> {
    const existing = await this.todoItemRepository.findOneBy({
      id,
      todoListId,
    });
    if (!existing) {
      throw new NotFoundException(
        `TodoItem with id ${id} not found in TodoList with id ${todoListId}`,
      );
    }
    const deletedAt = new Date();
    await this.todoItemRepository.update({ id, todoListId }, { deletedAt });
    // Publish the entity with the soft-delete marker so subscribers see the
    // deletedAt field on the wire and can react accordingly.
    this.changePublisher.publishItemChange('deleted', { ...existing, deletedAt });
  }
}
