import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateTodoListDto } from '../dtos/create-todo_list';
import { UpdateTodoListDto } from '../dtos/update-todo_list';
import { TodoList } from '../../interfaces/todo_list.interface';
// Alias the entity purely for Swagger `type:` references — the controller
// return-type contract stays on the interface (see AGENTS.md conventions).
import { TodoList as TodoListModel } from '../entities/todo_list.entity';
import { TodoListsService } from '../services/todo_lists.service';

@ApiTags('todo-lists')
@Controller('todo-lists')
export class TodoListsController {
  constructor(private todoListsService: TodoListsService) {}

  @Get()
  @ApiOperation({ summary: 'List all todo lists' })
  @ApiOkResponse({ type: TodoListModel, isArray: true })
  index(): Promise<TodoList[]> {
    return this.todoListsService.all();
  }

  @Get('/:todoListId')
  @ApiOperation({ summary: 'Get a todo list by id' })
  @ApiParam({ name: 'todoListId', type: Number, example: 42 })
  @ApiOkResponse({
    type: TodoListModel,
    description:
      'The list, or an empty body with HTTP 200 when the id does not exist (preserved behavior — see AGENTS.md).',
  })
  show(@Param() param: { todoListId: string }): Promise<TodoList | null> {
    return this.todoListsService.get(Number(param.todoListId));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new todo list' })
  @ApiOkResponse({ type: TodoListModel })
  create(@Body() dto: CreateTodoListDto): Promise<TodoList> {
    return this.todoListsService.create(dto);
  }

  @Put('/:todoListId')
  @ApiOperation({ summary: 'Update a todo list' })
  @ApiParam({ name: 'todoListId', type: Number, example: 42 })
  @ApiOkResponse({ type: TodoListModel })
  @ApiNotFoundResponse({ description: 'No todo list exists with that id.' })
  update(
    @Param() param: { todoListId: string },
    @Body() dto: UpdateTodoListDto,
  ): Promise<TodoList> {
    return this.todoListsService.update(Number(param.todoListId), dto);
  }

  @Delete('/:todoListId')
  @ApiOperation({ summary: 'Delete a todo list (hard delete)' })
  @ApiParam({ name: 'todoListId', type: Number, example: 42 })
  @ApiNoContentResponse({ description: 'The list was deleted.' })
  delete(@Param() param: { todoListId: string }): Promise<void> {
    return this.todoListsService.delete(Number(param.todoListId));
  }
}
