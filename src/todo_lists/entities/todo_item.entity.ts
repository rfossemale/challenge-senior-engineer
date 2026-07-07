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
import { TodoList } from './todo_list.entity';

@Entity()
// Partial index matching SyncService's "dirty push" scan for items.
@Index('idx_todo_item_dirty', ['updatedAt'], {
  where:
    '"externalId" IS NOT NULL AND "deletedAt" IS NULL AND ("lastSyncAt" IS NULL OR "updatedAt" > "lastSyncAt")',
})
export class TodoItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  description: string;

  @Column({ default: false })
  completed: boolean;

  @ManyToOne(() => TodoList, (todoList) => todoList.todoItems, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'todoListId' })
  todoList: TodoList;

  @Column()
  todoListId: number;

  @Column({ type: 'varchar', nullable: true })
  externalId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'int', default: 0 })
  missingSyncCycles: number;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
