import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CreateTodoListDto } from '../dtos/create-todo_list';
import { UpdateTodoListDto } from '../dtos/update-todo_list';
import { TodoList } from '../../interfaces/todo_list.interface';
import { TodoListsService } from '../services/todo_lists.service';

@Controller('todo-lists')
export class TodoListsController {
  constructor(private todoListsService: TodoListsService) {}

  @Get()
  index(): Promise<TodoList[]> {
    return this.todoListsService.all();
  }

  @Get('/:todoListId')
  show(@Param() param: { todoListId: string }): Promise<TodoList | null> {
    return this.todoListsService.get(Number(param.todoListId));
  }

  @Post()
  create(@Body() dto: CreateTodoListDto): Promise<TodoList> {
    return this.todoListsService.create(dto);
  }

  @Put('/:todoListId')
  update(
    @Param() param: { todoListId: string },
    @Body() dto: UpdateTodoListDto,
  ): Promise<TodoList> {
    return this.todoListsService.update(Number(param.todoListId), dto);
  }

  @Delete('/:todoListId')
  delete(@Param() param: { todoListId: string }): Promise<void> {
    return this.todoListsService.delete(Number(param.todoListId));
  }
}
