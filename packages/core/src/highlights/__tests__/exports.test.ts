/**
 * Guards the public API surface: `useHighlights` and the projection helper must
 * be reachable from the package index, while the API wrapper, the MMKV cache,
 * and the `Result` seam must not be — those are internals a consumer coupling to
 * would pin us out of the S1 library decision.
 */
import * as core from '../../index'

jest.mock('../../storage/mmkv-storage', () => ({
  mmkvStorage: {
    set: jest.fn(),
    getString: jest.fn(),
    remove: jest.fn(),
    getAllKeys: jest.fn(() => []),
  },
}))

describe('package exports', () => {
  it('exposes the highlights hook and the palette', () => {
    expect(typeof core.useHighlights).toBe('function')
    expect(typeof core.deriveServerColors).toBe('function')
    expect(typeof core.isHighlightColor).toBe('function')
    expect(core.HIGHLIGHT_COLORS).toEqual(['fffe00', '5dff79', '00d6ff', 'ffc66f', 'ff95ef'])
  })

  it('exposes the auth hooks', () => {
    expect(typeof core.useYVAuth).toBe('function')
    expect(typeof core.useYVAuthOptional).toBe('function')
  })

  it('keeps the client wrapper, the cache, and the Result seam internal', () => {
    const names = Object.keys(core)
    expect(names).not.toContain('createHighlightsApi')
    expect(names).not.toContain('getCachedHighlights')
    expect(names).not.toContain('setCachedHighlights')
    expect(names).not.toContain('clearHighlightsCache')
    expect(names).not.toContain('ok')
    expect(names).not.toContain('err')
  })

  it('keeps the granted-permissions store and the data-exchange session internal', () => {
    const names = Object.keys(core)
    // `grantedPermissions` / `hasPermission` / `requestPermission` on the auth
    // context are the whole surface — the storage and browser plumbing under
    // them is ours to change.
    expect(names).not.toContain('getGrantedPermissions')
    expect(names).not.toContain('saveGrantedPermissions')
    expect(names).not.toContain('addGrantedPermissions')
    expect(names).not.toContain('invalidateGrantedPermission')
    expect(names).not.toContain('clearGrantedPermissions')
    expect(names).not.toContain('subscribeGrantedPermissions')
    expect(names).not.toContain('requestPermissionViaDataExchange')
  })

  it('keeps the write queue internal', () => {
    const names = Object.keys(core)
    // `hasPendingHighlightOperations` / `discardPendingHighlights` on the auth
    // context and `hasPendingOperations` on `useHighlights` are the whole
    // surface. Persistence, backoff, and the generation counter are ours.
    expect(names).not.toContain('enqueuePendingOp')
    expect(names).not.toContain('peekDuePendingOp')
    expect(names).not.toContain('reschedulePendingOp')
    expect(names).not.toContain('completePendingOp')
    expect(names).not.toContain('retainPendingVerses')
    expect(names).not.toContain('supersedePendingVerses')
    expect(names).not.toContain('clearHighlightQueue')
    expect(names).not.toContain('getHighlightQueueSnapshot')
    expect(names).not.toContain('subscribeHighlightQueue')
    expect(names).not.toContain('beginHighlightWrite')
    expect(names).not.toContain('backoffDelayMs')
  })
})

/**
 * Types erase at runtime, so the names above cannot pin them. This block fails
 * the build if a public type stops being exported or changes shape.
 */
describe('package types', () => {
  it('exports the permission types the auth context speaks in', () => {
    const permission: core.AuthPermission = 'highlights'
    const known: core.KnownAuthPermission = 'highlights'
    const future: core.AuthPermission = 'verse_notes'
    const granted: core.RequestPermissionResult = { kind: 'granted', permissions: [permission] }
    const cancelled: core.RequestPermissionResult = { kind: 'cancel' }
    const failed: core.RequestPermissionResult = { kind: 'failure', message: 'nope' }

    expect([known, future, granted.kind, cancelled.kind, failed.kind]).toEqual([
      'highlights',
      'verse_notes',
      'granted',
      'cancel',
      'failure',
    ])
  })
})
