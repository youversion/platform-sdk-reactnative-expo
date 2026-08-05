/**
 * Layer 1 — the fetch gate's truth table, pinned directly.
 *
 * The gate is deliberately keyed on what the app *requested*, not on what the
 * user granted; the reasoning (and the failure mode each choice trades away)
 * lives on the predicate itself.
 */
import type { AuthPermission } from '../../auth'
import { shouldFetchHighlights } from '../use-highlights'

// The module under test reaches MMKV through the cache; the predicate itself is
// pure, so stub the native module rather than booting it.
jest.mock('../../storage/mmkv-storage', () => ({
  mmkvStorage: {
    set: jest.fn(),
    getString: jest.fn(),
    remove: jest.fn(),
    getAllKeys: jest.fn(() => []),
  },
}))

describe('shouldFetchHighlights', () => {
  it('skips when no permissions were requested', () => {
    expect(shouldFetchHighlights([])).toBe(false)
  })

  it('fetches when `highlights` was requested', () => {
    expect(shouldFetchHighlights(['highlights'])).toBe(true)
  })

  it('skips when other permissions were requested but not `highlights`', () => {
    expect(shouldFetchHighlights(['bibles', 'votd'])).toBe(false)
  })

  it('fetches when `highlights` is one of several requested permissions', () => {
    expect(shouldFetchHighlights(['bibles', 'highlights', 'demographics'])).toBe(true)
  })

  /**
   * Regression guard for the `hasPermission` anti-pattern. The predicate takes
   * the *requested* list and nothing else, so there is no grant state — known,
   * denied, or unknown — that can turn a requested `highlights` into a skip.
   *
   * This must survive C3.1's tightening: when a real grant is consulted, only a
   * KNOWN denial may skip. Unknown must still fetch, or every user already
   * signed in when C3.1 ships loses their painted highlights until they
   * re-authenticate.
   */
  it('fetches on a requested permission regardless of any grant state', () => {
    const requested: readonly AuthPermission[] = ['highlights']
    expect(shouldFetchHighlights(requested)).toBe(true)
    expect(shouldFetchHighlights.length).toBe(1)
  })
})
