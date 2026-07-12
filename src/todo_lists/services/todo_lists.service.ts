import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTodoListDto } from '../dtos/create-todo_list';
import { UpdateTodoListDto } from '../dtos/update-todo_list';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TodoList } from '../entities/todo_list.entity';
import { ChangePublisher } from '../../events/events.publisher';

@Injectable()
export class TodoListsService {
  constructor(
    @InjectRepository(TodoList)
    private readonly todoListRepository: Repository<TodoList>,
    private readonly changePublisher: ChangePublisher,
  ) {}

  async all(): Promise<TodoList[]> {
    return await this.todoListRepository.find();
  }

  async get(id: number): Promise<TodoList | null> {
    return await this.todoListRepository.findOneBy({ id });
  }

  async create(dto: CreateTodoListDto): Promise<TodoList> {
    const todoList = this.todoListRepository.create({ name: dto.name });
    const saved = await this.todoListRepository.save(todoList);
    this.changePublisher.publishListChange('created', saved);
    return saved;
  }

  async update(id: number, dto: UpdateTodoListDto): Promise<TodoList> {
    const todoList = await this.todoListRepository.findOneBy({ id });

    if (!todoList) {
      throw new NotFoundException(`TodoList with id ${id} not found`);
    }

    const saved = await this.todoListRepository.save({ ...todoList, ...dto });
    this.changePublisher.publishListChange('updated', saved);
    return saved;
  }

  async delete(id: number): Promise<void> {
    const existing = await this.todoListRepository.findOneBy({ id });
    if (!existing) {
      throw new NotFoundException(`TodoList with id ${id} not found`);
    }
    const deletedAt = new Date();
    await this.todoListRepository.update(id, { deletedAt });
    // Publish the entity with the soft-delete marker so subscribers see the
    // deletedAt field on the wire and can react accordingly.
    this.changePublisher.publishListChange('deleted', {
      ...existing,
      deletedAt,
    });
  }
}
