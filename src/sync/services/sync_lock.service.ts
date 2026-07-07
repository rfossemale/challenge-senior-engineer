import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Postgres session-scoped advisory lock so at most one sync cycle runs
 * across all replicas / manual triggers. Key is arbitrary but MUST be
 * stable — changing it forfeits the mutex until every process restarts.
 * Uses `pg_try_advisory_lock` (non-blocking) — a second trigger while a
 * cycle is in flight returns `false` and the caller skips instead of
 * queuing up.
 */
@Injectable()
export class SyncLockService {
  private static readonly LOCK_KEY = 4242;

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async tryAcquire(): Promise<boolean> {
    const rows: Array<{ locked: boolean }> = await this.dataSource.query(
      'SELECT pg_try_advisory_lock($1) AS locked',
      [SyncLockService.LOCK_KEY],
    );
    return rows[0]?.locked === true;
  }

  async release(): Promise<void> {
    await this.dataSource.query('SELECT pg_advisory_unlock($1)', [
      SyncLockService.LOCK_KEY,
    ]);
  }
}
