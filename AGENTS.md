# AGENTS.md — TodoApi (NestJS)

Small NestJS 11 + TypeORM + PostgreSQL Todo REST API. See [README.md](README.md) for the project blurb and [docs/docs/README.md](docs/docs/README.md) for the external Todo API spec ([external-api.yaml](docs/docs/external-api.yaml)) that this service is being aligned with (note the `externalId` / `lastSyncAt` columns on both entities).

## Commands

- Install: `npm install`
- Dev (watch): `npm run start:dev` — expects Postgres reachable via `DB_*` env vars (see [docker-compose.yml](docker-compose.yml))
- Build: `npm run build` (Nest CLI, outputs to `dist/`)
- Unit tests: `npm test` — Jest picks up any `*.spec.ts` under [src/](src/) (see `jest` block in [package.json](package.json))
- E2E tests: `npm run test:e2e` — separate Jest config at [test/jest-e2e.json](test/jest-e2e.json), only matches `*.e2e-spec.ts` in [src/e2e/](src/e2e/)
- Lint / format: `npm run lint` / `npm run format` — ESLint uses type-checked rules ([eslint.config.mjs](eslint.config.mjs)); `no-floating-promises` is a **warn**, so `await` async calls anyway
- Seed test data: `npm run seed` — truncates `todo_list` + `todo_item` and inserts fixtures via a standalone TypeORM DataSource ([src/data-source.ts](src/data-source.ts) → [src/seeds/seed.ts](src/seeds/seed.ts)). Requires the same `DB_*` env vars as the app.

The devcontainer auto-runs `npm install && npm run start:dev` on create ([.devcontainer/devcontainer.json](.devcontainer/devcontainer.json)); Postgres is already running as the `postgres` service.

## Architecture

Two feature modules:

- [src/todo_lists/todo_lists.module.ts](src/todo_lists/todo_lists.module.ts) — CRUD API for `TodoList` / `TodoItem`.
- [src/sync/sync.module.ts](src/sync/sync.module.ts) — bi-directional sync with the external Todo API (contract at [docs/docs/external-api.yaml](docs/docs/external-api.yaml)). Endpoint `POST /api/sync/run` triggers one cycle: `push local → pull remote → reconcile (LWW by updated_at)`. Single-cycle mutex via Postgres advisory lock. Deletes use a grace period (see `SYNC_DELETE_GRACE_CYCLES`). See [src/sync/services/sync.service.ts](src/sync/services/sync.service.ts) for the invariants comment.

Layering inside each feature is strict: `Controller` → `Service` → TypeORM `Repository<Entity>`. Entities in [src/todo_lists/entities/](src/todo_lists/entities/).

Two resources, nested route: `TodoList` (`/api/todo-lists`) owns `TodoItem` (`/api/todo-lists/:todoListId/todo-items`). The `api` prefix is set globally in [src/main.ts](src/main.ts) — replicate it in any new e2e test with `app.setGlobalPrefix('api')`.

DB config lives inline in [src/app.module.ts](src/app.module.ts) with `synchronize: true` and `migrationsRun: true` — schema is auto-derived from entity decorators, there are no migration files. Adding/removing entity columns takes effect on next boot; do not hand-write SQL migrations unless you also flip `synchronize` off.

## Env vars

- **DB**: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` (required; see [docker-compose.yml](docker-compose.yml) for defaults).
- **Sync**: `EXTERNAL_TODO_API_URL` (required to invoke sync; sync module logs a warning at boot if missing, `POST /api/sync/run` fails until it's set), `SYNC_SOURCE_ID` (default `local-dev`; identifies this instance in remote `source_id` fields — MUST be stable across restarts to preserve idempotency), `SYNC_DELETE_GRACE_CYCLES` (default `2`; how many consecutive pulls a remote record must be absent before we soft-delete locally), `SYNC_PUSH_CONCURRENCY` (default `8`; caps in-flight remote HTTP calls per push phase, avoids 429s — currently only wired into the delete-lists loop, see `runBounded` in [src/sync/util/concurrency.ts](src/sync/util/concurrency.ts)).
- **Sync HTTP retry** (all calls through [external_todo_api.client.ts](src/sync/clients/external_todo_api.client.ts) via `withRetry` in [src/sync/util/retry.ts](src/sync/util/retry.ts)): `SYNC_HTTP_MAX_ATTEMPTS` (default `3`, includes first try — set to `1` to disable retry), `SYNC_HTTP_BASE_DELAY_MS` (default `500`; doubles on each retry), `SYNC_HTTP_MAX_DELAY_MS` (default `10000`; ceiling for the exponential schedule and for any `Retry-After` header). Retries only fire on network errors, 429, and 5xx; 4xx surfaces immediately. `Retry-After` (seconds format) on 429 overrides the exponential delay for that attempt. No jitter yet.

## Project-specific conventions

- **Two `TodoList` / `TodoItem` types exist and are not interchangeable.** Controllers declare return types from [src/interfaces/](src/interfaces/) (plain shape: `id`, `name`, etc.), while services and repositories use the TypeORM entity classes from [src/todo_lists/entities/](src/todo_lists/entities/) (adds `createdAt`, `externalId`, `lastSyncAt`, `deletedAt`, relations). When editing, import from `entities/` inside services and `interfaces/` inside controller signatures — don't unify them without discussing first.
- **Route param names use camelCase**: `:todoListId`, `:todoItemId`. They arrive as strings; every handler wraps them in `Number(...)` before delegating (see [todo_items.controller.ts](src/todo_lists/controllers/todo_items.controller.ts)). Follow this pattern.
- **No `ValidationPipe` is registered.** DTOs in [src/todo_lists/dtos/](src/todo_lists/dtos/) are plain classes with no `class-validator` decorators — request bodies are trusted as-is. Don't assume validation runs.
- **Not-found handling is inconsistent by design of the current code**: `TodoListsService.update` throws `NotFoundException`, but `show`/`get` returns `null` (surfaces as HTTP 200 with empty body — see the e2e assertion for `/api/todo-lists/999`). `TodoItemsService.update` uses `save({ id, todoListId, ...dto })` and will _upsert_ rather than 404. Preserve existing behavior unless the task explicitly asks to fix it (there are tests pinning it).
- **Path aliases `@todo-lists` / `@todo-lists/*`** are declared in [tsconfig.json](tsconfig.json) but not currently used anywhere. Prefer relative imports to match the existing code.
- **Barrel** at [src/todo_lists/index.ts](src/todo_lists/index.ts) re-exports the module, services, and entities — use it from outside the feature folder.

## Tests

- Unit specs live in [src/tests/](src/tests/); one duplicate service spec sits next to the code at [src/todo_lists/services/todo_lists.service.spec.ts](src/todo_lists/services/todo_lists.service.spec.ts) — Jest runs both. When adding tests, put them under `src/tests/` to match convention.
- E2E specs live in [src/e2e/](src/e2e/) and must end in `.e2e-spec.ts` (the `.e2e.spec.ts` variant is a stale sibling that is _not_ picked up by [test/jest-e2e.json](test/jest-e2e.json)).
- E2E tests here **mock the TypeORM repository** via `getRepositoryToken(Entity)` — they do not spin up Postgres. See [src/e2e/todo_lists.controller.e2e-spec.ts](src/e2e/todo_lists.controller.e2e-spec.ts) for the exact setup to copy.

## Pitfalls

- Running `npm test` without Postgres is fine (unit tests mock the repo), but `npm run start` / `start:dev` will crash on boot if `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` are missing.
- `synchronize: true` will drop or alter columns when entity decorators change — don't rename a column casually against a shared DB.
- The external API in [docs/docs/external-api.yaml](docs/docs/external-api.yaml) uses `/todolists/{todolistId}` (no dash, `PATCH` for updates); the internal API uses `/api/todo-lists/:todoListId` with `PUT`. Do not conflate the two when writing sync code.
- The external contract has no `POST /todolists/{id}/todoitems` — new local items on already-remote lists are logged and skipped by [SyncService](src/sync/services/sync.service.ts) (they'll retry once the endpoint exists). Do not "fix" this by deleting and recreating the remote list; it would nuke remote item IDs and `created_at`.
- Sync interfaces (`Remote*` in [src/sync/interfaces/](src/sync/interfaces/)) use `snake_case` and `id: string` because that's what the remote emits — do not normalize them there; keep translation in [src/sync/mappers/](src/sync/mappers/).
