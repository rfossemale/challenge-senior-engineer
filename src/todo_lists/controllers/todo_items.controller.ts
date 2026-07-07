import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CreateTodoItemDto } from '../dtos/create-todo_item';
import { UpdateTodoItemDto } from '../dtos/update-todo_item';
import { TodoItem } from '../../interfaces/todo_item.interface';
import { TodoItemsService } from '../services/todo_items.service';

@Controller('todo-lists/:todoListId/todo-items')
export class TodoItemsController {
  constructor(private todoItemsService: TodoItemsService) {}

  @Get()
  index(@Param() param: { todoListId: number }): Promise<TodoItem[]> {
    return this.todoItemsService.all(Number(param.todoListId));
  }

  @Get('/:todoItemId')
  show(
    @Param() param: { todoListId: number; todoItemId: number },
  ): Promise<TodoItem | null> {
    return this.todoItemsService.get(
      Number(param.todoListId),
      Number(param.todoItemId),
    );
  }

  @Post()
  create(
    @Param() param: { todoListId: number },
    @Body() dto: CreateTodoItemDto,
  ): Promise<TodoItem> {
    return this.todoItemsService.create(Number(param.todoListId), dto);
  }

  @Put('/:todoItemId')
  update(
    @Param() param: { todoListId: string; todoItemId: string },
    @Body() dto: UpdateTodoItemDto,
  ): Promise<TodoItem> {
    return this.todoItemsService.update(
      Number(param.todoListId),
      Number(param.todoItemId),
      dto,
    );
  }

  @Delete('/:todoItemId')
  delete(
    @Param() param: { todoListId: number; todoItemId: number },
  ): Promise<void> {
    return this.todoItemsService.delete(
      Number(param.todoListId),
      Number(param.todoItemId),
    );
  }
}
