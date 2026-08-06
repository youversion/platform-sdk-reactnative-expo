/**
 * Layer 1 — the foreground-refetch truth table, pinned directly.
 *
 * The predicate is deliberately narrower than "the app is active": `inactive` is
 * where `expo-web-browser` parks the app during sign-in and consent on iOS, and
 * those flows refetch on their own. This table is what stops a future
 * simplification to `next === 'active'`.
 */
import type { AppStateStatus } from 'react-native'

import { shouldRefetchOnForeground } from '../use-highlights'

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

describe('shouldRefetchOnForeground', () => {
  const cases: [AppStateStatus, AppStateStatus, boolean][] = [
    ['background', 'active', true],
    // The iOS auth-session window. Refetching here would double-fetch every
    // consent round-trip, which already refetches on the identity change.
    ['inactive', 'active', false],
    ['active', 'inactive', false],
    ['active', 'background', false],
    ['inactive', 'background', false],
    ['background', 'inactive', false],
    ['active', 'active', false],
  ]

  it.each(cases)('%s → %s refetches: %s', (previous, next, expected) => {
    expect(shouldRefetchOnForeground(previous, next)).toBe(expected)
  })
})
