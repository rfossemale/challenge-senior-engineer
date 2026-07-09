import {
  Entity,
  Column,
  Index,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { TodoList } from './todo_list.entity';

@Entity()
// Partial index matching SyncService's "dirty push" scan for items.
@Index('idx_todo_item_dirty', ['updatedAt'], {
  where:
    '"externalId" IS NOT NULL AND "deletedAt" IS NULL AND ("lastSyncAt" IS NULL OR "updatedAt" > "lastSyncAt")',
})
export class TodoItem {
  @ApiProperty({ example: 101 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Buy milk' })
  @Column()
  description: string;

  @ApiProperty({ example: false, default: false })
  @Column({ default: false })
  completed: boolean;

  @ManyToOne(() => TodoList, (todoList) => todoList.todoItems, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'todoListId' })
  todoList: TodoList;

  @ApiProperty({ example: 42, description: 'Owning TodoList id.' })
  @Column()
  todoListId: number;

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
}
