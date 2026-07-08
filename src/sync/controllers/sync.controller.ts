import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { SyncReport, SyncService } from '../services/sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * Triggers one sync cycle synchronously and returns the reconciliation
   * report. Safe to call concurrently — the second call sees `lock-busy`
   * and returns immediately without corrupting state.
   */
  @Post('run')
  @HttpCode(200)
  run(): Promise<SyncReport> {
    return this.syncService.run();
  }

  @Get('status')
  @HttpCode(200)
  status() {
    return this.syncService.test();
  }
}
