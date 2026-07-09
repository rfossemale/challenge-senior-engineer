import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TodoItem } from './todo_item.entity';

@Entity()
// Partial index that matches the exact predicate used by SyncService's
// "dirty push" scan — Postgres uses it to avoid scanning fresh/unsynced rows.
@Index('idx_todo_list_dirty', ['updatedAt'], {
  where:
    '"externalId" IS NOT NULL AND "deletedAt" IS NULL AND ("lastSyncAt" IS NULL OR "updatedAt" > "lastSyncAt")',
})
export class TodoList {
  @ApiProperty({ example: 42 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Groceries' })
  @Column()
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'Remote id in the external Todo API once synced; null before first push.',
  })
  @Column({ type: 'varchar', nullable: true })
  externalId: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @UpdateDateColumn()
  updatedAt: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Timestamp of the last successful sync round-trip.',
  })
  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @ApiProperty({
    example: 0,
    description:
      'Consecutive pulls this record has been missing on the remote — used by the grace-period soft-delete rule.',
  })
  @Column({ type: 'int', default: 0 })
  missingSyncCycles: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Soft-delete marker (TypeORM). Null means the row is active.',
  })
  @DeleteDateColumn()
  deletedAt: Date | null;

  @OneToMany(() => TodoItem, (todoItem) => todoItem.todoList)
  todoItems: TodoItem[];
}
