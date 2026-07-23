/**
 * Local Result seam for S1 (YPE-3706). Keep callers importing from here so the
 * ADR outcome (better-result / neverthrow / Effect) swaps a single module.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
