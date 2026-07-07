import { Test, TestingModule } from '@nestjs/testing';
import { TodoItemsController } from '../todo_lists/controllers/todo_items.controller';
import { TodoItemsService } from '../todo_lists/services/todo_items.service';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TodoItem } from '../todo_lists/entities/todo_item.entity';

describe('TodoItemsController', () => {
  let app: INestApplication;
  let todoItemsController: TodoItemsController;
  let todoItemRepositoryMock: jest.Mocked<Record<string, jest.Mock>>;

  beforeEach(async () => {
    todoItemRepositoryMock = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodoItemsController],
      providers: [
        TodoItemsService,
        {
          provide: getRepositoryToken(TodoItem),
          useValue: todoItemRepositoryMock,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    todoItemsController = module.get<TodoItemsController>(TodoItemsController);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('index', () => {
    it('should return all todo items for a list', async () => {
      const mockTodoItems = [
        { id: 1, description: 'Buy milk', completed: false, todoListId: 1 },
        { id: 2, description: 'Buy eggs', completed: true, todoListId: 1 },
      ];

      todoItemRepositoryMock.find.mockResolvedValue(mockTodoItems);

      const result = await todoItemsController.index({ todoListId: 1 });

      expect(result).toEqual(mockTodoItems);
      expect(todoItemRepositoryMock.find).toHaveBeenCalledWith({
        where: { todoListId: 1 },
      });
    });
  });

  describe('show', () => {
    it('should return a single todo item by id', async () => {
      const mockTodoItem = {
        id: 1,
        description: 'Buy milk',
        completed: false,
        todoListId: 1,
      };
      todoItemRepositoryMock.findOneBy.mockResolvedValue(mockTodoItem);
      const result = await todoItemsController.show({
        todoListId: 1,
        todoItemId: 1,
      });
      expect(result).toEqual(mockTodoItem);
    });
  });

  describe('create', () => {
    it('should create a new todo item', async () => {
      const createDto = { description: 'New task' };
      const mockCreatedTodoItem = {
        id: 1,
        description: 'New task',
        completed: false,
        todoListId: 1,
      };

      todoItemRepositoryMock.create.mockReturnValue(mockCreatedTodoItem);
      todoItemRepositoryMock.save.mockResolvedValue(mockCreatedTodoItem);

      const result = await todoItemsController.create(
        { todoListId: 1 },
        createDto,
      );

      expect(result).toEqual(mockCreatedTodoItem);
    });
  });

  describe('update', () => {
    it('should update an existing todo item', async () => {
      const updateDto = { description: 'Updated task', completed: true };
      const updatedTodoItem = {
        id: 1,
        description: 'Updated task',
        completed: true,
        todoListId: 1,
      };

      todoItemRepositoryMock.save.mockResolvedValue(updatedTodoItem);

      const result = await todoItemsController.update(
        { todoListId: '1', todoItemId: '1' },
        updateDto,
      );

      expect(result).toEqual(updatedTodoItem);
    });
  });

  describe('delete', () => {
    it('should delete a todo item', async () => {
      todoItemRepositoryMock.delete.mockResolvedValue({ affected: 1 });
      await todoItemsController.delete({ todoListId: 1, todoItemId: 1 });
      expect(todoItemRepositoryMock.delete).toHaveBeenCalledWith({
        id: 1,
        todoListId: 1,
      });
    });
  });
});
