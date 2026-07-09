import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { SyncReport, SyncService } from '../services/sync.service';

@ApiTags('sync')
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
  @ApiOperation({
    summary: 'Run one sync cycle (push local → pull remote → reconcile)',
    description:
      'Concurrency-safe: the second in-flight call short-circuits with `skipped: true, reason: "lock-busy"` and does not perform any push/pull work.',
  })
  @ApiOkResponse({ type: SyncReport })
  @ApiServiceUnavailableResponse({
    description:
      'The external Todo API is not configured (EXTERNAL_TODO_API_URL missing) or unreachable after retries.',
  })
  run(): Promise<SyncReport> {
    return this.syncService.run();
  }

  @Get('status')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Liveness probe against the external Todo API',
    description:
      'Performs `GET /todolists` on the remote and returns the raw list, mainly to verify connectivity and credentials from this instance.',
  })
  status() {
    return this.syncService.test();
  }
}
