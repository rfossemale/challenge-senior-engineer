import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TodoListsService } from './todo_lists.service';
import { TodoList } from '../entities/todo_list.entity';

describe('TodoListsService', () => {
  let service: TodoListsService;
  let todoListRepositoryMock: jest.Mocked<Record<string, jest.Mock>>;

  beforeEach(async () => {
    todoListRepositoryMock = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodoListsService,
        {
          provide: getRepositoryToken(TodoList),
          useValue: todoListRepositoryMock,
        },
      ],
    }).compile();

    service = module.get<TodoListsService>(TodoListsService);
  });

  describe('all', () => {
    it('returns every todo list from the repository', async () => {
      const mockTodoLists = [
        { id: 1, name: 'Shopping List' },
        { id: 2, name: 'Work Tasks' },
      ];
      todoListRepositoryMock.find.mockResolvedValue(mockTodoLists);

      const result = await service.all();

      expect(result).toEqual(mockTodoLists);
      expect(todoListRepositoryMock.find).toHaveBeenCalledWith();
    });
  });

  describe('get', () => {
    it('returns the todo list matching the id', async () => {
      const mockTodoList = { id: 1, name: 'Shopping List' };
      todoListRepositoryMock.findOneBy.mockResolvedValue(mockTodoList);

      const result = await service.get(1);

      expect(result).toEqual(mockTodoList);
      expect(todoListRepositoryMock.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('returns null when the todo list does not exist', async () => {
      todoListRepositoryMock.findOneBy.mockResolvedValue(null);

      const result = await service.get(999);

      expect(result).toBeNull();
      expect(todoListRepositoryMock.findOneBy).toHaveBeenCalledWith({
        id: 999,
      });
    });
  });

  describe('create', () => {
    it('creates a todo list from the dto and persists it', async () => {
      const createDto = { name: 'New List' };
      const builtTodoList = { name: 'New List' };
      const savedTodoList = { id: 1, name: 'New List' };

      todoListRepositoryMock.create.mockReturnValue(builtTodoList);
      todoListRepositoryMock.save.mockResolvedValue(savedTodoList);

      const result = await service.create(createDto);

      expect(todoListRepositoryMock.create).toHaveBeenCalledWith({
        name: 'New List',
      });
      expect(todoListRepositoryMock.save).toHaveBeenCalledWith(builtTodoList);
      expect(result).toEqual(savedTodoList);
    });
  });

  describe('update', () => {
    it('merges the dto onto the existing todo list and saves it', async () => {
      const existingTodoList = { id: 1, name: 'Old Name' };
      const updateDto = { name: 'Updated Name' };
      const updatedTodoList = { id: 1, name: 'Updated Name' };

      todoListRepositoryMock.findOneBy.mockResolvedValue(existingTodoList);
      todoListRepositoryMock.save.mockResolvedValue(updatedTodoList);

      const result = await service.update(1, updateDto);

      expect(todoListRepositoryMock.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(todoListRepositoryMock.save).toHaveBeenCalledWith({
        ...existingTodoList,
        ...updateDto,
      });
      expect(result).toEqual(updatedTodoList);
    });

    it('throws NotFoundException when the todo list does not exist', async () => {
      todoListRepositoryMock.findOneBy.mockResolvedValue(null);

      await expect(service.update(999, { name: 'Nope' })).rejects.toThrow(
        NotFoundException,
      );
      expect(todoListRepositoryMock.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('delegates deletion to the repository', async () => {
      todoListRepositoryMock.delete.mockResolvedValue({ affected: 1 });

      await service.delete(1);

      expect(todoListRepositoryMock.delete).toHaveBeenCalledWith(1);
    });
  });
});
