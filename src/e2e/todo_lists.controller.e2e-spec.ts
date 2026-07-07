import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { TodoListsController } from '../todo_lists/controllers/todo_lists.controller';
import { TodoListsService } from '../todo_lists/services/todo_lists.service';
import { TodoList } from '../todo_lists/entities/todo_list.entity';

describe('TodoListsController (e2e)', () => {
  let app: INestApplication;
  let httpServer: App;
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
      controllers: [TodoListsController],
      providers: [
        TodoListsService,
        {
          provide: getRepositoryToken(TodoList),
          useValue: todoListRepositoryMock,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    httpServer = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/todo-lists', () => {
    it('returns all todo lists', async () => {
      const mockTodoLists = [
        { id: 1, name: 'Shopping List' },
        { id: 2, name: 'Work Tasks' },
      ];
      todoListRepositoryMock.find.mockResolvedValue(mockTodoLists);

      const response = await request(httpServer)
        .get('/api/todo-lists')
        .expect(200);

      expect(response.body).toEqual(mockTodoLists);
      expect(todoListRepositoryMock.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /api/todo-lists/:todoListId', () => {
    it('returns a single todo list by id', async () => {
      const mockTodoList = { id: 1, name: 'Shopping List' };
      todoListRepositoryMock.findOneBy.mockResolvedValue(mockTodoList);

      const response = await request(httpServer)
        .get('/api/todo-lists/1')
        .expect(200);

      expect(response.body).toEqual(mockTodoList);
      expect(todoListRepositoryMock.findOneBy).toHaveBeenCalledWith({ id: 1 });
    });

    it('returns an empty body when the todo list is not found', async () => {
      todoListRepositoryMock.findOneBy.mockResolvedValue(null);

      const response = await request(httpServer)
        .get('/api/todo-lists/999')
        .expect(200);

      expect(response.body).toEqual({});
      expect(todoListRepositoryMock.findOneBy).toHaveBeenCalledWith({
        id: 999,
      });
    });
  });

  describe('POST /api/todo-lists', () => {
    it('creates a new todo list', async () => {
      const createDto = { name: 'New List' };
      const mockCreatedTodoList = { id: 1, name: 'New List' };

      todoListRepositoryMock.create.mockReturnValue(mockCreatedTodoList);
      todoListRepositoryMock.save.mockResolvedValue(mockCreatedTodoList);

      const response = await request(httpServer)
        .post('/api/todo-lists')
        .send(createDto)
        .expect(201);

      expect(response.body).toEqual(mockCreatedTodoList);
      expect(todoListRepositoryMock.create).toHaveBeenCalledWith({
        name: 'New List',
      });
      expect(todoListRepositoryMock.save).toHaveBeenCalledWith(
        mockCreatedTodoList,
      );
    });
  });

  describe('PUT /api/todo-lists/:todoListId', () => {
    it('updates an existing todo list', async () => {
      const updateDto = { name: 'Updated List' };
      const existingTodoList = { id: 1, name: 'Old Name' };
      const updatedTodoList = { id: 1, name: 'Updated List' };

      todoListRepositoryMock.findOneBy.mockResolvedValue(existingTodoList);
      todoListRepositoryMock.save.mockResolvedValue(updatedTodoList);

      const response = await request(httpServer)
        .put('/api/todo-lists/1')
        .send(updateDto)
        .expect(200);

      expect(response.body).toEqual(updatedTodoList);
      expect(todoListRepositoryMock.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(todoListRepositoryMock.save).toHaveBeenCalledWith({
        ...existingTodoList,
        ...updateDto,
      });
    });

    it('returns 404 when the todo list does not exist', async () => {
      todoListRepositoryMock.findOneBy.mockResolvedValue(null);

      await request(httpServer)
        .put('/api/todo-lists/999')
        .send({ name: 'Nope' })
        .expect(404);

      expect(todoListRepositoryMock.save).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/todo-lists/:todoListId', () => {
    it('deletes a todo list', async () => {
      todoListRepositoryMock.delete.mockResolvedValue({ affected: 1 });

      await request(httpServer).delete('/api/todo-lists/1').expect(200);

      expect(todoListRepositoryMock.delete).toHaveBeenCalledWith(1);
    });
  });
});
