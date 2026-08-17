import { nextBackoffDelay } from '../backoff'

// The shape is pinned; the intervals are not. Backoff numbers are tuning, and
// asserting them makes retuning a test-rewriting exercise.
describe('nextBackoffDelay', () => {
  const cap = nextBackoffDelay(Number.MAX_SAFE_INTEGER)

  it('waits before the first attempt, so a parked write is not chased instantly', () => {
    expect(nextBackoffDelay(0)).toBeGreaterThan(0)
  })

  it('at least doubles with each failure — exponential, not a linear ramp', () => {
    for (let failures = 0; nextBackoffDelay(failures) < cap; failures++) {
      const current = nextBackoffDelay(failures)
      expect(nextBackoffDelay(failures + 1)).toBeGreaterThanOrEqual(Math.min(2 * current, cap))
    }
  })

  it('reaches the cap and stays there, so an entry the server keeps refusing stays cheap', () => {
    expect(Number.isFinite(cap)).toBe(true)
    expect(nextBackoffDelay(1000)).toBe(cap)
    for (let failures = 0; failures <= 100; failures++) {
      expect(nextBackoffDelay(failures)).toBeLessThanOrEqual(cap)
    }
  })

  it('treats a nonsense failure count as a first attempt rather than NaN', () => {
    expect(nextBackoffDelay(-5)).toBe(nextBackoffDelay(0))
    expect(nextBackoffDelay(NaN)).toBe(nextBackoffDelay(0))
  })
})
