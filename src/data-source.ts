import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { TodoItem } from './todo_lists/entities/todo_item.entity';
import { TodoList } from './todo_lists/entities/todo_list.entity';

/**
 * Standalone TypeORM DataSource used by out-of-Nest scripts (seeder,
 * ad-hoc migrations, REPL). Mirrors the connection settings from
 * `src/app.module.ts` — reads the same `DB_*` env vars, targets the same
 * entities, and keeps `synchronize: true` for parity with the app.
 *
 * The Nest application does NOT use this DataSource; it uses its own via
 * `TypeOrmModule.forRoot(...)`. Keeping two DataSources is safe because
 * both share identical schema derivation.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [TodoList, TodoItem],
  synchronize: true,
  logging: false,
});
