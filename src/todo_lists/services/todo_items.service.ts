import { Injectable } from '@nestjs/common';
import { CreateTodoItemDto } from '../dtos/create-todo_item';
import { UpdateTodoItemDto } from '../dtos/update-todo_item';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TodoItem } from '../entities/todo_item.entity';

@Injectable()
export class TodoItemsService {
  constructor(
    @InjectRepository(TodoItem)
    private readonly todoItemRepository: Repository<TodoItem>,
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
    return await this.todoItemRepository.save(todoItem);
  }

  async update(
    todoListId: number,
    id: number,
    dto: UpdateTodoItemDto,
  ): Promise<TodoItem> {
    return await this.todoItemRepository.save({
      id,
      todoListId,
      ...dto,
    } as TodoItem);
  }

  async delete(todoListId: number, id: number): Promise<void> {
    await this.todoItemRepository.delete({ id, todoListId });
  }
}
