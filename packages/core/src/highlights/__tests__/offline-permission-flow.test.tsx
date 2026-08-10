import { act, renderHook } from '@testing-library/react-native'
import * as WebBrowser from 'expo-web-browser'
import type { ReactNode } from 'react'

import type { AuthPermission, DataExchangeOutcome } from '../../auth'
import { AuthContext, type AuthContextValue } from '../../auth/auth-context'
import type { DataExchangeApiResult } from '../../auth/data-exchange-api'
import { requestDataExchange } from '../../auth/data-exchange'
import {
  loadCachedGrantedPermissions,
  saveGrantedPermissions,
} from '../../auth/granted-permissions-cache'
import type { Result } from '../../result'
import { YouVersionContext } from '../../youversion-context'
import type { HighlightsApiError } from '../api'
import { highlightQueueKey, type HighlightScope, type QueuedWrites } from '../constants'
import { hasQueuedHighlightWrites } from '../queue'
import {
  useHighlightPermissionFlow,
  type UseHighlightPermissionFlowResult,
} from '../use-highlight-permission-flow'
import type { HighlightWriteOutcome, UseHighlightsOptions } from '../use-highlights'

// ── Boundaries ───────────────────────────────────────────────────────────────
// One vertical seam, faked at the external edges: MMKV, the highlights API
// client, the data-exchange mint, and the browser. The one internal double is
// the auth context — a real `AuthProvider` would drag in secure storage and the
// whole PKCE flow for nothing this suite asks about. See `hasPermission`.
//
// The whole suite runs offline: every network edge is unreachable.

const mockMmkv = new Map<string, string>()

jest.mock('../../storage/mmkv-storage', () => ({
  mmkvStorage: {
    set: jest.fn((k: string, v: string) => {
      mockMmkv.set(k, v)
    }),
    getString: jest.fn((k: string) => mockMmkv.get(k)),
    remove: jest.fn((k: string) => {
      mockMmkv.delete(k)
    }),
    getAllKeys: jest.fn(() => Array.from(mockMmkv.keys())),
    has: jest.fn((k: string) => mockMmkv.has(k)),
  },
}))

const mockGetHighlights = jest.fn()
const mockCreateHighlight = jest.fn()
const mockDeleteHighlight = jest.fn()

jest.mock('../api', () => ({
  createHighlightsApi: jest.fn(() => ({
    getHighlights: mockGetHighlights,
    createHighlight: mockCreateHighlight,
    deleteHighlight: mockDeleteHighlight,
  })),
}))

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}))

const mockOpenAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock

/** The data-exchange mint. Offline, so it never gets an answer. */
const mockMintToken = jest.fn<Promise<DataExchangeApiResult<string>>, [string, readonly string[]]>()

// ── Fixtures ─────────────────────────────────────────────────────────────────

const YELLOW = 'fffe00'

const scope: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }
const options: UseHighlightsOptions = { versionId: 111, book: 'JHN', chapter: '3' }
const userId = 'user-1'

const NETWORK_DOWN = 'Network request failed'

function apiError(error: HighlightsApiError): Result<never, HighlightsApiError> {
  return { ok: false, error }
}

/** No response at all — airplane mode, dead wifi, a timeout. */
const unreachable = () => apiError({ kind: 'transient', message: NETWORK_DOWN })

const mockSignIn = jest.fn<Promise<void>, []>()
const mockInvalidatePermissions = jest.fn<void, []>()

/** The one thing that varies across the three describe blocks. */
let signedIn = true

/**
 * The initiator identity `requestDataExchange` guards on. Constant here: nothing
 * in this suite changes user mid-flow.
 */
const identity = { sessionId: 1, userId }

/** Whatever the MMKV grant cache holds for this user — `null` when signed out. */
function cachedGrant(): AuthPermission[] | null {
  return signedIn ? loadCachedGrantedPermissions(userId) : null
}

/**
 * Shaped after `AuthProvider`'s own read: an `includes` over a grant it seeded
 * from the **local MMKV cache**, never a call to anyone.
 *
 * Two halves of ADR 0014, pinned in two places. That the grant is *seeded* from
 * cache belongs to the provider, and is pinned there — see
 * `auth/__tests__/auth-provider.test.tsx`, 'seeds the grant synchronously from
 * cache on a cold start'.
 *
 * What this suite pins is the other half: that the cached answer is **enough on
 * its own** to reach the write path. Every network edge here is unreachable, so
 * anything the pre-flight might add in front of the write — a server check, a
 * re-consent, a mint "just to be sure the hint is true" — fails the granted
 * block below. Checked by mutating the branch, not assumed.
 */
function hasPermission(permission: AuthPermission): boolean {
  return cachedGrant()?.includes(permission) ?? false
}

/** The real just-in-time grant, wired to a mint that cannot reach the server. */
function requestPermissions(permissions: readonly AuthPermission[]): Promise<DataExchangeOutcome> {
  return requestDataExchange({
    api: { mintToken: mockMintToken },
    appKey: 'app-key',
    apiHost: 'api.youversion.com',
    accessToken: 'token-1',
    redirectUri: 'youversionauth://callback',
    initiator: identity,
    permissions,
    getCurrentIdentity: () => identity,
  })
}

function authValue(): AuthContextValue {
  return {
    isAuthenticated: signedIn,
    accessToken: signedIn ? 'token-1' : null,
    userInfo: signedIn ? { id: userId } : null,
    error: null,
    signIn: mockSignIn,
    signOut: jest.fn(),
    refreshNow: jest.fn(),
    ensureFreshToken: jest.fn(async () => undefined),
    isLoading: false,
    requestedPermissions: ['highlights'],
    grantedPermissions: cachedGrant(),
    hasPermission,
    invalidatePermissions: mockInvalidatePermissions,
    requestPermissions,
  }
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <YouVersionContext.Provider
      value={{ appKey: 'app-key', apiHost: 'api.youversion.com', installationId: 'install-1' }}
    >
      <AuthContext.Provider value={authValue()}>{children}</AuthContext.Provider>
    </YouVersionContext.Provider>
  )
}

type FlowResult = { current: UseHighlightPermissionFlowResult }

function renderFlow() {
  return renderHook(() => useHighlightPermissionFlow(options), { wrapper: Wrapper })
}

/**
 * Start an apply and hand back its promise **unawaited** — the consent flow is
 * still waiting on the user when this returns, so awaiting here would hang.
 * Wrapped in an object because `await` unwraps a returned promise recursively.
 */
async function startApply(
  result: FlowResult,
): Promise<{ promise: Promise<HighlightWriteOutcome> }> {
  let promise: Promise<HighlightWriteOutcome> | undefined
  await act(async () => {
    promise = result.current.apply(YELLOW, [16])
  })
  if (promise === undefined) {
    throw new Error('apply() did not return a promise')
  }
  return { promise }
}

function paintedColors(result: FlowResult): Record<string, string> {
  return Object.fromEntries(
    result.current.highlights.highlights.map((h) => [h.passage_id, h.color]),
  )
}

function queuedWrites(): QueuedWrites | null {
  const raw = mockMmkv.get(highlightQueueKey(userId, scope))
  return raw === undefined ? null : (JSON.parse(raw) as QueuedWrites)
}

/** Let the mount fetch (and anything else already queued) settle. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  mockMmkv.clear()
  jest.clearAllMocks()
  signedIn = true

  // Offline, everywhere.
  mockGetHighlights.mockResolvedValue(unreachable())
  mockCreateHighlight.mockResolvedValue(unreachable())
  mockDeleteHighlight.mockResolvedValue(unreachable())
  mockMintToken.mockResolvedValue({
    ok: false,
    error: { kind: 'transient', message: NETWORK_DOWN },
  })
  mockSignIn.mockResolvedValue(undefined)
})

describe('offline, signed in, without the highlights grant', () => {
  it('paints nothing and persists no queued write — the mint fails before any browser opens', async () => {
    const { result } = renderFlow()
    await flush()

    const { promise: outcome } = await startApply(result)

    // The tap opened the consent prompt. Nothing has been painted or persisted:
    // a Pending Highlight waits on a permission, not on the server.
    expect(result.current.isConfirming).toBe(true)
    expect(paintedColors(result)).toEqual({})
    expect(queuedWrites()).toBeNull()

    await act(async () => {
      result.current.confirm()
    })
    await flush()

    expect(await outcome).toEqual({
      status: 'error',
      reason: 'transient',
      message: NETWORK_DOWN,
      failedVerses: [16],
      succeededVerses: [],
    })

    // The mint was attempted and failed; the browser was never opened, so the
    // user never saw a consent page they could not have completed.
    expect(mockMintToken).toHaveBeenCalledWith('token-1', ['highlights'])
    expect(mockOpenAuthSession).not.toHaveBeenCalled()

    // The rejected alternative (ADR 0017): queue it optimistically and let the
    // drain un-paint it later, with no explanation.
    expect(paintedColors(result)).toEqual({})
    expect(queuedWrites()).toBeNull()
    expect(hasQueuedHighlightWrites(userId)).toBe(false)
    expect(mockCreateHighlight).not.toHaveBeenCalled()
  })

  it('discards the pending highlight rather than persisting it — a remount shows nothing', async () => {
    const { result, unmount } = renderFlow()
    await flush()

    const { promise: outcome } = await startApply(result)
    await act(async () => {
      result.current.confirm()
    })
    await flush()
    await outcome
    unmount()

    const remounted = renderFlow()
    await flush()

    expect(paintedColors(remounted.result)).toEqual({})
    expect(hasQueuedHighlightWrites(userId)).toBe(false)
  })

  it('reports the failure through the existing flow error surface, unchanged', async () => {
    const { result } = renderFlow()
    await flush()

    const { promise: outcome } = await startApply(result)
    await act(async () => {
      result.current.confirm()
    })
    await flush()
    await outcome

    expect(result.current.isConfirming).toBe(false)
    expect(result.current.flowError).toEqual({ reason: 'transient', message: NETWORK_DOWN })
  })

  it('leaves nothing behind when the user declines the prompt instead', async () => {
    const { result } = renderFlow()
    await flush()

    const { promise: outcome } = await startApply(result)
    await act(async () => {
      result.current.decline()
    })
    await flush()

    expect(await outcome).toEqual({ status: 'noop' })
    expect(result.current.flowError).toBeNull()
    expect(paintedColors(result)).toEqual({})
    expect(hasQueuedHighlightWrites(userId)).toBe(false)
    expect(mockMintToken).not.toHaveBeenCalled()
  })
})

describe('offline, signed in, WITH the cached highlights grant', () => {
  // The contrast that keeps the rule straight. This user sails past the flow
  // entirely and lands in an ordinary write that fails at the network and parks.
  //
  // It works only because the CACHED grant is taken at its word (ADR 0014). Make
  // the pre-flight confirm that hint with the server and offline highlighting
  // stops working for every user — these two tests are what fail when it does.
  // See `hasPermission` above for the half of ADR 0014 pinned elsewhere.
  beforeEach(() => {
    saveGrantedPermissions(userId, ['highlights'])
  })

  it('writes straight through and queues normally, on the strength of the cached grant alone', async () => {
    const { result } = renderFlow()
    await flush()

    const { promise: outcome } = await startApply(result)

    // Checked before the outcome is awaited, and deliberately: a pre-flight that
    // went asking the server would park here waiting on a consent nobody can
    // reach, and awaiting first would report that as a five-second timeout
    // instead of as the assertion it is.
    expect(result.current.isConfirming).toBe(false)

    await flush()

    expect(await outcome).toEqual({ status: 'queued', verses: [16] })

    // Painted and owed: the write is parked, not lost.
    expect(paintedColors(result)).toEqual({ 'JHN.3.16': YELLOW })
    expect(queuedWrites()).toEqual({ 16: { local: YELLOW, server: null } })

    // No flow ran at all — no prompt, no mint, no browser.
    expect(result.current.isConfirming).toBe(false)
    expect(result.current.flowError).toBeNull()
    expect(mockMintToken).not.toHaveBeenCalled()
    expect(mockOpenAuthSession).not.toHaveBeenCalled()
  })

  // Also the positive control for the ungranted user's remount above: without a
  // case where a remount *does* repaint, that test's empty result proves nothing.
  it('keeps the parked write across a relaunch', async () => {
    const { result, unmount } = renderFlow()
    await flush()
    const { promise } = await startApply(result)
    await promise
    unmount()

    const remounted = renderFlow()
    await flush()

    expect(paintedColors(remounted.result)).toEqual({ 'JHN.3.16': YELLOW })
    expect(hasQueuedHighlightWrites(userId)).toBe(true)
  })
})

describe('offline, not signed in', () => {
  beforeEach(() => {
    signedIn = false
  })

  it('takes the sign-in branch exactly as it does online, and persists nothing', async () => {
    const { result } = renderFlow()
    await flush()

    const { promise: outcome } = await startApply(result)
    await flush()

    // Sign-in was attempted and the user is still signed out, so the flow ends
    // with nothing to report — the same path as a cancelled sign-in online.
    expect(mockSignIn).toHaveBeenCalledTimes(1)
    expect(await outcome).toEqual({ status: 'noop' })
    expect(result.current.flowError).toBeNull()

    // Consent never came up, so the mint was never reached.
    expect(mockMintToken).not.toHaveBeenCalled()
    expect(mockOpenAuthSession).not.toHaveBeenCalled()

    // Nothing is keyed under the signed-out user, and nothing under the user who
    // would be signed in if they had completed it.
    expect(hasQueuedHighlightWrites(userId)).toBe(false)
    expect(paintedColors(result)).toEqual({})
  })
})
