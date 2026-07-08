/**
 * Jitter strategy applied on top of the exponential backoff cap
 * (see `withRetry`). Not applied when `computeDelayHint` returns a
 * value — server-provided `Retry-After` is treated as authoritative.
 *
 * - `none`: always sleep exactly the capped exponential delay.
 * - `full`: uniform in `[0, cap]`. Best spread against thundering herd
 *   (AWS "Exponential Backoff And Jitter" recommendation). Default.
 * - `equal`: uniform in `[cap/2, cap]`. Guarantees a minimum wait of
 *   half the exponential delay while still spreading callers out.
 */
export type JitterStrategy = 'none' | 'full' | 'equal';

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
   * fall back to the standard exponential schedule. Jitter is skipped
   * when this returns a value.
   */
  computeDelayHint?: (error: unknown) => number | null;
  /**
   * Jitter applied to the exponential delay. Defaults to `'full'`, which
   * spreads concurrent retries uniformly in `[0, cap]` and is the
   * standard mitigation for thundering-herd against a recovering remote.
   */
  jitter?: JitterStrategy;
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
 * Runs `op` with exponential backoff on retryable failures. Base schedule:
 *   base, base*2, base*4, ...  each capped at `maxDelayMs`.
 *
 * Jitter is layered on top of that cap (see `JitterStrategy`, default
 * `'full'`) so N concurrent callers hitting the same transient failure
 * don't converge on the same retry instant. Jitter is intentionally
 * skipped when `computeDelayHint` returns a value — a server-provided
 * `Retry-After` is authoritative and should be honored as-is.
 */
export async function withRetry<T>(
  op: () => Promise<T>,
  opts: RetryOptions,
): Promise<T> {
  const attempts = Math.max(1, opts.maxAttempts);
  const jitter: JitterStrategy = opts.jitter ?? 'full';
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === attempts;
      if (isLast || !opts.isRetryable(err)) throw err;
      const hinted = opts.computeDelayHint?.(err) ?? null;
      const cap = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1),
        opts.maxDelayMs,
      );
      const delayMs = hinted ?? applyJitter(cap, jitter);
      opts.onRetry?.({ attempt, delayMs, error: err });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  // Unreachable — the loop either returns or throws — but TS needs it.
  throw lastErr;
}

function applyJitter(cap: number, strategy: JitterStrategy): number {
  switch (strategy) {
    case 'none':
      return cap;
    case 'equal': {
      const half = cap / 2;
      return Math.floor(half + Math.random() * half);
    }
    case 'full':
    default:
      return Math.floor(Math.random() * cap);
  }
}
