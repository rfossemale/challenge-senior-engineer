import type { RemoteTodoList, RemoteTodoItem } from '../interfaces';

/**
 * Compares a remote timestamp (ISO-8601 string) against a local `Date` to
 * decide who wins in Last-Write-Wins. Missing / invalid remote timestamps
 * are treated as "older than local" — never overwrite local with an
 * unclockable remote payload.
 */
export function remoteIsNewer(
  remoteUpdatedAt: string | undefined,
  localUpdatedAt: Date,
): boolean {
  if (!remoteUpdatedAt) return false;
  const remoteMs = Date.parse(remoteUpdatedAt);
  if (Number.isNaN(remoteMs)) return false;
  return remoteMs > localUpdatedAt.getTime();
}

export interface RemoteListFields {
  name: string;
}

export function extractRemoteListFields(
  remote: RemoteTodoList,
  fallback: { name: string },
): RemoteListFields {
  return { name: remote.name ?? fallback.name };
}

export interface RemoteItemFields {
  description: string;
  completed: boolean;
}

export function extractRemoteItemFields(
  remote: RemoteTodoItem,
  fallback: { description: string; completed: boolean },
): RemoteItemFields {
  return {
    description: remote.description ?? fallback.description,
    completed: remote.completed ?? fallback.completed,
  };
}
