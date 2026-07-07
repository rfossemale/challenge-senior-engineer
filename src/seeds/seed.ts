import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { TodoItem } from '../todo_lists/entities/todo_item.entity';
import { TodoList } from '../todo_lists/entities/todo_list.entity';

/**
 * Fixture seeder. Wipes `todo_list` and `todo_item` and re-inserts a small
 * set of lists with mixed states — some never-synced (externalId null),
 * some already-synced with a fake externalId — so sync scenarios can be
 * exercised against a predictable baseline.
 *
 * Run with `npm run seed`. Requires the `DB_*` env vars (same as the app).
 */

interface ItemFixture {
  description: string;
  completed: boolean;
  externalId?: string;
}

interface ListFixture {
  name: string;
  externalId?: string;
  items: ItemFixture[];
}

const FIXTURES: ListFixture[] = [
  {
    name: 'Groceries',
    items: [
      { description: 'Buy milk', completed: false },
      { description: 'Buy bread', completed: false },
      { description: 'Buy coffee beans', completed: true },
    ],
  },
  {
    name: 'Work tasks',
    items: [
      { description: 'Review PR #142', completed: true },
      { description: 'Write ADR for sync module', completed: false },
      { description: 'Update AGENTS.md', completed: true },
      { description: 'Ship v2 API', completed: false },
    ],
  },
  {
    // Simulates a list that was previously synced with the remote —
    // useful for exercising the "dirty push" path when you edit its name
    // locally before running sync.
    name: 'Weekend chores',
    externalId: 'seed-remote-list-3',
    items: [
      {
        description: 'Mow the lawn',
        completed: false,
        externalId: 'seed-remote-item-3a',
      },
      {
        description: 'Wash the car',
        completed: false,
        externalId: 'seed-remote-item-3b',
      },
    ],
  },
  {
    name: 'Empty list',
    items: [],
  },
];

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    const listRepo = AppDataSource.getRepository(TodoList);
    const itemRepo = AppDataSource.getRepository(TodoItem);
    const listTable = listRepo.metadata.tableName;
    const itemTable = itemRepo.metadata.tableName;

    console.log(`Truncating ${itemTable}, ${listTable}...`);
    await AppDataSource.query(
      `TRUNCATE TABLE "${itemTable}", "${listTable}" RESTART IDENTITY CASCADE`,
    );

    console.log('Inserting fixtures:');
    for (const fx of FIXTURES) {
      const savedList = await listRepo.save(
        listRepo.create({
          name: fx.name,
          externalId: fx.externalId ?? null,
          lastSyncAt: fx.externalId ? new Date() : null,
        }),
      );
      for (const it of fx.items) {
        await itemRepo.save(
          itemRepo.create({
            description: it.description,
            completed: it.completed,
            todoListId: savedList.id,
            externalId: it.externalId ?? null,
            lastSyncAt: it.externalId ? new Date() : null,
          }),
        );
      }
      const tag = fx.externalId ? ' [synced]' : '';
      console.log(
        `  ${savedList.id}. ${fx.name} — ${fx.items.length} item(s)${tag}`,
      );
    }

    console.log('Seed complete.');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});
