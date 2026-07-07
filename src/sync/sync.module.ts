import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { TodoListsModule } from '../todo_lists/todo_lists.module';
import { ExternalTodoApiClient } from './clients/external_todo_api.client';
import { SyncController } from './controllers/sync.controller';
import { SYNC_REPOSITORY } from './repositories/sync.repository';
import { TypeormSyncRepository } from './repositories/typeorm-sync.repository';
import { SyncLockService } from './services/sync_lock.service';
import { SyncService } from './services/sync.service';

@Module({
  imports: [
    HttpModule.register({ timeout: 10_000, maxRedirects: 3 }),
    TodoListsModule,
  ],
  controllers: [SyncController],
  providers: [
    ExternalTodoApiClient,
    SyncLockService,
    SyncService,
    { provide: SYNC_REPOSITORY, useClass: TypeormSyncRepository },
  ],
  exports: [SyncService],
})
export class SyncModule {}
