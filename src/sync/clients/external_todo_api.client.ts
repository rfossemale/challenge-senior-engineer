import { HttpService } from '@nestjs/axios';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type {
  CreateRemoteTodoListBody,
  RemoteTodoItem,
  RemoteTodoList,
  UpdateRemoteTodoItemBody,
  UpdateRemoteTodoListBody,
} from '../interfaces';

/**
 * Typed wrapper for the external Todo API described in
 * `docs/docs/external-api.yaml`. All paths use the *external* schema:
 * `/todolists` (no dash), `PATCH` for updates. Do NOT confuse with our
 * internal `/api/todo-lists` (see AGENTS.md).
 */
@Injectable()
export class ExternalTodoApiClient implements OnModuleInit {
  private readonly logger = new Logger(ExternalTodoApiClient.name);
  private baseUrl = '';

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const url = this.config.get<string>('EXTERNAL_TODO_API_URL');
    if (!url) {
      this.logger.warn(
        'EXTERNAL_TODO_API_URL is not set. Sync module cannot reach the remote API — /api/sync/run will fail until this is configured.',
      );
      return;
    }
    this.baseUrl = url.replace(/\/$/, '');
  }

  private url(path: string): string {
    if (!this.baseUrl) {
      throw new Error(
        'EXTERNAL_TODO_API_URL is not configured — set it before invoking sync.',
      );
    }
    return `${this.baseUrl}${path}`;
  }

  async listTodoLists(): Promise<RemoteTodoList[]> {
    const res = await firstValueFrom(
      this.http.get<RemoteTodoList[]>(this.url('/todolists')),
    ).catch(this.rethrow('GET /todolists'));
    return res.data ?? [];
  }

  async createTodoList(
    body: CreateRemoteTodoListBody,
  ): Promise<RemoteTodoList> {
    const res = await firstValueFrom(
      this.http.post<RemoteTodoList>(this.url('/todolists'), body),
    ).catch(this.rethrow('POST /todolists'));
    return res.data;
  }

  async updateTodoList(
    todolistId: string,
    body: UpdateRemoteTodoListBody,
  ): Promise<RemoteTodoList> {
    const res = await firstValueFrom(
      this.http.patch<RemoteTodoList>(
        this.url(`/todolists/${encodeURIComponent(todolistId)}`),
        body,
      ),
    ).catch(this.rethrow(`PATCH /todolists/${todolistId}`));
    return res.data;
  }

  async deleteTodoList(todolistId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(
        this.url(`/todolists/${encodeURIComponent(todolistId)}`),
      ),
    ).catch(this.rethrow(`DELETE /todolists/${todolistId}`));
  }

  async updateTodoItem(
    todolistId: string,
    todoitemId: string,
    body: UpdateRemoteTodoItemBody,
  ): Promise<RemoteTodoItem> {
    const res = await firstValueFrom(
      this.http.patch<RemoteTodoItem>(
        this.url(
          `/todolists/${encodeURIComponent(
            todolistId,
          )}/todoitems/${encodeURIComponent(todoitemId)}`,
        ),
        body,
      ),
    ).catch(
      this.rethrow(`PATCH /todolists/${todolistId}/todoitems/${todoitemId}`),
    );
    return res.data;
  }

  async deleteTodoItem(todolistId: string, todoitemId: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(
        this.url(
          `/todolists/${encodeURIComponent(
            todolistId,
          )}/todoitems/${encodeURIComponent(todoitemId)}`,
        ),
      ),
    ).catch(
      this.rethrow(`DELETE /todolists/${todolistId}/todoitems/${todoitemId}`),
    );
  }

  private rethrow(op: string): (err: unknown) => never {
    return (err: unknown) => {
      if (err instanceof AxiosError) {
        const status = err.response?.status ?? 'no-response';
        throw new Error(`${op} failed (${status}): ${err.message}`);
      }
      throw err instanceof Error
        ? err
        : new Error(`${op} failed: ${String(err)}`);
    };
  }
}
