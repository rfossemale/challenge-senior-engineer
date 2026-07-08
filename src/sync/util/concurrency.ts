/**
 * Runs `worker` over every item with at most `limit` invocations in flight
 * at any moment. Uses a sliding-window worker pool: whenever any worker
 * finishes an item, it picks up the next one from a shared iterator —
 * strictly better than `chunk(N).map(parallel)` because the batch never
 * idles waiting for the slowest task of the current chunk.
 *
 * Per-item resilience: errors thrown by `worker(item)` are caught and
 * forwarded to `onError` (or logged to stderr as a fallback). A single
 * failure never stops the batch — sibling workers keep pulling items.
 *
 * `Promise.allSettled` is used at the outer wait as a second safety net,
 * so an unexpected failure inside the worker loop itself (a bug in
 * `onError`, an iterator that throws, etc.) doesn't abort the other
 * in-flight workers via `Promise.all`'s first-rejection semantics.
 *
 * Concurrency safety: JavaScript is single-threaded, so shared writes done
 * synchronously between `await` points inside `worker`/`onError` (e.g.
 * incrementing a counter, pushing to an errors array) are safe without
 * locks.
 */
export async function runBounded<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  onError?: (error: unknown, item: T) => void,
): Promise<void> {
  if (items.length === 0 || limit <= 0) return;
  const iter = items[Symbol.iterator]();
  const workerCount = Math.min(limit, items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    for (const item of iter) {
      try {
        await worker(item);
      } catch (err) {
        if (onError) {
          onError(err, item);
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`runBounded worker failed: ${msg}`);
        }
      }
    }
  });
  await Promise.allSettled(workers);
}
