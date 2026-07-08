export interface RetryOptions {
  /** Total attempts INCLUDING the first try. `1` disables retry. */
  maxAttempts: number;
  /** First backoff delay in ms. Doubles on each subsequent retry. */
  baseDelayMs: number;
  /** Ceiling for the exponentially growing delay in ms. */
  maxDelayMs: number;
  /** Called on each caught error; return true to schedule a retry. */
  isRetryable: (error: unknown) => boolean;
  /**
   * Optional hint that overrides the exponential delay for a specific
   * attempt — used to honor `Retry-After` on HTTP 429. Return `null` to
   * fall back to the standard exponential schedule.
   */
  computeDelayHint?: (error: unknown) => number | null;
  /**
   * Fired just before sleeping between attempts. Useful for logging.
   * Never fired before the first attempt or after the final failure.
   */
  onRetry?: (info: {
    attempt: number;
    delayMs: number;
    error: unknown;
  }) => void;
}

/**
 * Runs `op` with exponential backoff on retryable failures. Schedule:
 *   base, base*2, base*4, ...  each capped at `maxDelayMs`.
 *
 * TODO: no jitter yet — under load with many concurrent workers, this
 * schedule can produce thundering-herd retries against a recovering
 * remote. Adding decorrelated jitter is a planned follow-up.
 */
export async function withRetry<T>(
  op: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const attempts = Math.max(1, opts.maxAttempts);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === attempts;
      if (isLast || !opts.isRetryable(err)) throw err;
      const hinted = opts.computeDelayHint?.(err) ?? null;
      const exp = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1),
        opts.maxDelayMs,
      );
      const delayMs = hinted ?? exp;
      opts.onRetry?.({ attempt, delayMs, error: err });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Unreachable — the loop either returns or throws — but TS needs it.
  throw lastErr;
}
