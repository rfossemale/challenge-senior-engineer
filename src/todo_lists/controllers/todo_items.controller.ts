import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
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
import { CreateTodoItemDto } from '../dtos/create-todo_item';
import { UpdateTodoItemDto } from '../dtos/update-todo_item';
import { TodoItem } from '../../interfaces/todo_item.interface';
// Alias the entity purely for Swagger `type:` references — the controller
// return-type contract stays on the interface (see AGENTS.md conventions).
import { TodoItem as TodoItemModel } from '../entities/todo_item.entity';
import { TodoItemsService } from '../services/todo_items.service';
import { TodoListsService } from '../services/todo_lists.service';

@ApiTags('todo-items')
@ApiParam({ name: 'todoListId', type: Number, example: 42 })
@Controller('todo-lists/:todoListId/todo-items')
export class TodoItemsController {
  constructor(
    private todoListsService: TodoListsService,
    private todoItemsService: TodoItemsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all items in a todo list' })
  @ApiOkResponse({ type: TodoItemModel, isArray: true })
  index(@Param() param: { todoListId: number }): Promise<TodoItem[]> {
    return this.todoItemsService.all(Number(param.todoListId));
  }

  @Get('/:todoItemId')
  @ApiOperation({ summary: 'Get one item by id (within a todo list)' })
  @ApiParam({ name: 'todoItemId', type: Number, example: 101 })
  @ApiOkResponse({
    type: TodoItemModel,
    description:
      'The item, or an empty body with HTTP 200 when the id does not exist (preserved behavior — see AGENTS.md).',
  })
  show(
    @Param() param: { todoListId: number; todoItemId: number },
  ): Promise<TodoItem | null> {
    return this.todoItemsService.get(
      Number(param.todoListId),
      Number(param.todoItemId),
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a new item under a todo list' })
  @ApiOkResponse({ type: TodoItemModel })
  create(
    @Param() param: { todoListId: number },
    @Body() dto: CreateTodoItemDto,
  ): Promise<TodoItem> {
    return this.todoItemsService.create(Number(param.todoListId), dto);
  }

  @Put('/:todoItemId')
  @ApiOperation({
    summary: 'Update an item',
    description:
      'Returns 404 if the parent todo list does not exist. The item id itself still upserts via save() and will NOT 404 for a missing item id — see AGENTS.md.',
  })
  @ApiParam({ name: 'todoItemId', type: Number, example: 101 })
  @ApiOkResponse({ type: TodoItemModel })
  @ApiNotFoundResponse({ description: 'Parent todo list not found.' })
  async update(
    @Param() param: { todoListId: string; todoItemId: string },
    @Body() dto: UpdateTodoItemDto,
  ): Promise<TodoItem> {
    const item = await this.todoListsService.get(Number(param.todoListId));
    if (!item) {
      throw new NotFoundException(
        `Todo list with id ${param.todoListId} not found`,
      );
    }
    return this.todoItemsService.update(
      Number(param.todoListId),
      Number(param.todoItemId),
      dto,
    );
  }

  @Delete('/:todoItemId')
  @ApiOperation({ summary: 'Delete an item (hard delete)' })
  @ApiParam({ name: 'todoItemId', type: Number, example: 101 })
  @ApiNoContentResponse({ description: 'The item was deleted.' })
  delete(
    @Param() param: { todoListId: number; todoItemId: number },
  ): Promise<void> {
    return this.todoItemsService.delete(
      Number(param.todoListId),
      Number(param.todoItemId),
    );
  }
}
