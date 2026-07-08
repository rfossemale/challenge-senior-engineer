import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import type {
  CreateRemoteTodoListBody,
  RemoteTodoItem,
  RemoteTodoList,
  UpdateRemoteTodoItemBody,
  UpdateRemoteTodoListBody,
} from '../interfaces';
import { withRetry } from '../util/retry';

/**
 * Typed wrapper for the external Todo API described in
 * `docs/docs/external-api.yaml`. All paths use the *external* schema:
 * `/todolists` (no dash), `PATCH` for updates. Do NOT confuse with our
 * internal `/api/todo-lists` (see AGENTS.md).
 *
 * Every call goes through `request<T>()`, which adds:
 * - Exponential backoff retry on network errors, 429 and 5xx.
 *   Config via `SYNC_HTTP_MAX_ATTEMPTS`, `SYNC_HTTP_BASE_DELAY_MS`,
 *   `SYNC_HTTP_MAX_DELAY_MS`.
 * - `Retry-After` header (seconds format) honored on 429 responses.
 * - 4xx errors (other than 429) are surfaced immediately — they indicate
 *   a client bug, not a transient failure.
 *
 * Caveat on POST retries: `POST /todolists` is not idempotent, but the
 * remote enforces uniqueness on `source_id`, so a retried POST after a
 * timed-out successful attempt will surface as a 4xx (conflict) rather
 * than duplicate. The caller sees the error and reports it; we don't
 * currently follow up with a lookup by source_id to recover the id.
 */
@Injectable()
export class ExternalTodoApiClient implements OnModuleInit {
  private readonly logger = new Logger(ExternalTodoApiClient.name);
  private baseUrl = '';
  private retryMaxAttempts = 3;
  private retryBaseDelayMs = 500;
  private retryMaxDelayMs = 10_000;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const url = this.config
      .get<string>('EXTERNAL_TODO_API_URL', 'http://localhost:3001')
      .trim();
    if (!url) {
      this.logger.warn(
        'EXTERNAL_TODO_API_URL is not set. Sync module cannot reach the remote API — /api/sync/run will fail until this is configured.',
      );
    } else {
      this.baseUrl = url.replace(/\/$/, '');
    }
    this.retryMaxAttempts = Math.max(
      1,
      Number(this.config.get<string>('SYNC_HTTP_MAX_ATTEMPTS', '3')),
    );
    this.retryBaseDelayMs = Math.max(
      1,
      Number(this.config.get<string>('SYNC_HTTP_BASE_DELAY_MS', '500')),
    );
    this.retryMaxDelayMs = Math.max(
      this.retryBaseDelayMs,
      Number(this.config.get<string>('SYNC_HTTP_MAX_DELAY_MS', '10000')),
    );
  }

  private url(path: string): string {
    if (!this.baseUrl) {
      throw new Error(
        'EXTERNAL_TODO_API_URL is not configured — set it before invoking sync.',
      );
    }
    return `${this.baseUrl}${path}`;
  }

  listTodoLists(): Promise<RemoteTodoList[]> {
    return this.request('GET /todolists', () =>
      firstValueFrom(this.http.get<RemoteTodoList[]>(this.url('/todolists'))),
    ).then((data) => data ?? []);
  }

  createTodoList(body: CreateRemoteTodoListBody): Promise<RemoteTodoList> {
    return this.request('POST /todolists', () =>
      firstValueFrom(
        this.http.post<RemoteTodoList>(this.url('/todolists'), body),
      ),
    );
  }

  updateTodoList(
    todolistId: string,
    body: UpdateRemoteTodoListBody,
  ): Promise<RemoteTodoList> {
    return this.request(`PATCH /todolists/${todolistId}`, () =>
      firstValueFrom(
        this.http.patch<RemoteTodoList>(
          this.url(`/todolists/${encodeURIComponent(todolistId)}`),
          body,
        ),
      ),
    );
  }

  async deleteTodoList(todolistId: string): Promise<void> {
    await this.request(`DELETE /todolists/${todolistId}`, () =>
      firstValueFrom(
        this.http.delete<void>(
          this.url(`/todolists/${encodeURIComponent(todolistId)}`),
        ),
      ),
    );
  }

  updateTodoItem(
    todolistId: string,
    todoitemId: string,
    body: UpdateRemoteTodoItemBody,
  ): Promise<RemoteTodoItem> {
    return this.request(
      `PATCH /todolists/${todolistId}/todoitems/${todoitemId}`,
      () =>
        firstValueFrom(
          this.http.patch<RemoteTodoItem>(
            this.url(
              `/todolists/${encodeURIComponent(
                todolistId,
              )}/todoitems/${encodeURIComponent(todoitemId)}`,
            ),
            body,
          ),
        ),
    );
  }

  async deleteTodoItem(todolistId: string, todoitemId: string): Promise<void> {
    await this.request(
      `DELETE /todolists/${todolistId}/todoitems/${todoitemId}`,
      () =>
        firstValueFrom(
          this.http.delete<void>(
            this.url(
              `/todolists/${encodeURIComponent(
                todolistId,
              )}/todoitems/${encodeURIComponent(todoitemId)}`,
            ),
          ),
        ),
    );
  }

  private async request<T>(
    op: string,
    call: () => Promise<AxiosResponse<T>>,
  ): Promise<T> {
    try {
      const res = await withRetry(call, {
        maxAttempts: this.retryMaxAttempts,
        baseDelayMs: this.retryBaseDelayMs,
        maxDelayMs: this.retryMaxDelayMs,
        isRetryable: isRetryableHttpError,
        computeDelayHint: (err) => this.parseRetryAfterMs(err),
        onRetry: ({ attempt, delayMs, error }) => {
          const status =
            error instanceof AxiosError
              ? (error.response?.status ?? 'no-response')
              : 'unknown';
          this.logger.warn(
            `${op} attempt ${attempt}/${this.retryMaxAttempts} failed (${status}); retrying in ${delayMs}ms`,
          );
        },
      });
      return res.data;
    } catch (err) {
      if (err instanceof AxiosError) {
        const status = err.response?.status ?? 'no-response';
        throw new Error(`${op} failed (${status}): ${err.message}`);
      }
      throw err instanceof Error
        ? err
        : new Error(`${op} failed: ${String(err)}`);
    }
  }

  private parseRetryAfterMs(err: unknown): number | null {
    if (!(err instanceof AxiosError)) return null;
    const raw: unknown = err.response?.headers?.['retry-after'];
    if (typeof raw !== 'string') return null;
    const seconds = Number(raw);
    if (!Number.isFinite(seconds) || seconds < 0) return null;
    return Math.min(Math.floor(seconds * 1000), this.retryMaxDelayMs);
  }
}

/**
 * Retry classifier for HTTP calls: network failures (no response), 429
 * (rate limit), and 5xx (server errors) are transient and worth retrying.
 * Everything else (4xx client errors, non-axios errors) is not.
 */
function isRetryableHttpError(err: unknown): boolean {
  if (!(err instanceof AxiosError)) return false;
  if (!err.response) return true;
  const s = err.response.status;
  return s === 429 || (s >= 500 && s < 600);
}
