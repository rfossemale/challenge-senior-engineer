import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TodoListsModule } from './todo_lists/todo_lists.module';
import { SyncModule } from './sync/sync.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TodoList } from './todo_lists/entities/todo_list.entity';
import { TodoItem } from './todo_lists/entities/todo_item.entity';
import { InitSchema1751846400000 } from './migrations/1751846400000-InitSchema';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TodoListsModule,
    SyncModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [TodoList, TodoItem],
      migrations: [InitSchema1751846400000],
      migrationsRun: true,
      synchronize: false,
      logging: true,
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
