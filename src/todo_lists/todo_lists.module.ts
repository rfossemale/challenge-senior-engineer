import { Module } from '@nestjs/common';
import { TodoListsController } from './controllers/todo_lists.controller';
import { TodoListsService } from './services/todo_lists.service';
import { TodoItemsController } from './controllers/todo_items.controller';
import { TodoItemsService } from './services/todo_items.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoList } from './entities/todo_list.entity';
import { TodoItem } from './entities/todo_item.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([TodoList, TodoItem]), EventsModule],
  controllers: [TodoListsController, TodoItemsController],
  providers: [TodoListsService, TodoItemsService],
  exports: [
    TodoListsService,
    TodoItemsService,
    TypeOrmModule.forFeature([TodoList, TodoItem]),
  ],
})
export class TodoListsModule {}
