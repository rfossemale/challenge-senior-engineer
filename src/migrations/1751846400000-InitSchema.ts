import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1751846400000 implements MigrationInterface {
  name = 'InitSchema1751846400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "todo_list" (
        "id" SERIAL NOT NULL,
        "name" character varying NOT NULL,
        "externalId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastSyncAt" TIMESTAMP,
        "missingSyncCycles" integer NOT NULL DEFAULT 0,
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_todo_list_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "todo_item" (
        "id" SERIAL NOT NULL,
        "description" character varying NOT NULL,
        "completed" boolean NOT NULL DEFAULT false,
        "todoListId" integer NOT NULL,
        "externalId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastSyncAt" TIMESTAMP,
        "missingSyncCycles" integer NOT NULL DEFAULT 0,
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_todo_item_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "todo_item"
      ADD CONSTRAINT "FK_todo_item_todoListId"
      FOREIGN KEY ("todoListId") REFERENCES "todo_list"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Partial indexes mirroring SyncService's "dirty push" scan predicate.
    await queryRunner.query(`
      CREATE INDEX "idx_todo_list_dirty" ON "todo_list" ("updatedAt")
      WHERE "externalId" IS NOT NULL
        AND "deletedAt" IS NULL
        AND ("lastSyncAt" IS NULL OR "updatedAt" > "lastSyncAt")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_todo_item_dirty" ON "todo_item" ("updatedAt")
      WHERE "externalId" IS NOT NULL
        AND "deletedAt" IS NULL
        AND ("lastSyncAt" IS NULL OR "updatedAt" > "lastSyncAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_todo_item_dirty"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_todo_list_dirty"`);
    await queryRunner.query(
      `ALTER TABLE "todo_item" DROP CONSTRAINT IF EXISTS "FK_todo_item_todoListId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "todo_item"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "todo_list"`);
  }
}
