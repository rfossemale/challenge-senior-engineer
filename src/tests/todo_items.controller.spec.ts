import { Test, TestingModule } from '@nestjs/testing';
import { TodoItemsController } from '../todo_lists/controllers/todo_items.controller';
import { TodoItemsService } from '../todo_lists/services/todo_items.service';
import { TodoListsService } from '../todo_lists/services/todo_lists.service';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TodoItem } from '../todo_lists/entities/todo_item.entity';
import { TodoList } from '../todo_lists/entities/todo_list.entity';
import { ChangePublisher } from '../events/events.publisher';

describe('TodoItemsController', () => {
  let app: INestApplication;
  let todoItemsController: TodoItemsController;
  let todoItemRepositoryMock: jest.Mocked<Record<string, jest.Mock>>;
  let todoListRepositoryMock: jest.Mocked<Record<string, jest.Mock>>;

  beforeEach(async () => {
    todoItemRepositoryMock = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      merge: jest.fn((entity, dto) => ({ ...entity, ...dto })),
    };
    todoListRepositoryMock = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodoItemsController],
      providers: [
        TodoItemsService,
        TodoListsService,
        {
          provide: getRepositoryToken(TodoItem),
          useValue: todoItemRepositoryMock,
        },
        {
          provide: getRepositoryToken(TodoList),
          useValue: todoListRepositoryMock,
        },
        {
          provide: ChangePublisher,
          useValue: {
            publishListChange: jest.fn(),
            publishItemChange: jest.fn(),
          },
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
      const existingTodoItem = {
        id: 1,
        description: 'Buy milk',
        completed: false,
        todoListId: 1,
      };
      const updatedTodoItem = {
        id: 1,
        description: 'Updated task',
        completed: true,
        todoListId: 1,
      };

      // Parent list must exist for the update handler to proceed past the
      // NotFoundException guard.
      todoListRepositoryMock.findOneBy.mockResolvedValue({
        id: 1,
        name: 'A list',
      });
      // Service also fetches the existing item before merging + saving.
      todoItemRepositoryMock.findOneBy.mockResolvedValue(existingTodoItem);
      todoItemRepositoryMock.save.mockResolvedValue(updatedTodoItem);

      const result = await todoItemsController.update(
        { todoListId: '1', todoItemId: '1' },
        updateDto,
      );

      expect(result).toEqual(updatedTodoItem);
    });
  });

  describe('delete', () => {
    it('should soft-delete a todo item', async () => {
      const existingTodoItem = {
        id: 1,
        description: 'Buy milk',
        completed: false,
        todoListId: 1,
      };
      todoItemRepositoryMock.findOneBy.mockResolvedValue(existingTodoItem);
      todoItemRepositoryMock.update.mockResolvedValue({ affected: 1 });

      await todoItemsController.delete({ todoListId: 1, todoItemId: 1 });

      expect(todoItemRepositoryMock.update).toHaveBeenCalledWith(
        { id: 1, todoListId: 1 },
        expect.objectContaining({ deletedAt: expect.any(Date) }),
      );
    });
  });
});
