/**
 * Local Result seam for S1 (YPE-3706). Keep callers importing from here so the
 * ADR outcome (better-result / neverthrow / Effect) swaps a single module.
 */
export type Result<Value, Error> =
  | { ok: true; value: Value }
  | { ok: false; error: Error }

export function ok<Value>(value: Value): Result<Value, never> {
  return { ok: true, value }
}

export function err<Error>(error: Error): Result<never, Error> {
  return { ok: false, error }
}
