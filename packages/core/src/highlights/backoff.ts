/**
 * How long a queue entry waits before the drain tries it again.
 *
 * Exponential and capped, per ADR 0018: an entry the server permanently refuses
 * is never dropped, so the only thing keeping it cheap is that it settles at one
 * attempt an hour rather than one per drain tick.
 */

const BASE_DELAY_MS = 10_000
const GROWTH_FACTOR = 2
const MAX_DELAY_MS = 60 * 60 * 1000

/**
 * `failures` is the count of failures BEFORE the one being recorded — `drain.ts`
 * reads the stored count, calls this, and increments in the same step. A fresh
 * entry therefore passes 0, so the first failure waits the base delay.
 */
export function nextBackoffDelay(failures: number): number {
  const steps = Number.isFinite(failures) ? Math.max(0, Math.trunc(failures)) : 0
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * GROWTH_FACTOR ** steps)
}
