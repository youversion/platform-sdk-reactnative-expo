import type { Collection, Highlight } from '@youversion/platform-core'
import { act, render, renderHook } from '@testing-library/react-native'
import { AppState, Text, type AppStateStatus } from 'react-native'
import type { ReactNode } from 'react'

import { AuthContext, type AccessTokenResult, type AuthContextValue } from '../../auth/auth-context'
import { YouVersionContext } from '../../youversion-context'
import type { Result } from '../../result'
import type { HighlightsApiError } from '../api'
import { highlightsCacheKey, type HighlightScope } from '../constants'
import {
  useHighlights,
  type HighlightWriteOutcome,
  type UseHighlightsResult,
} from '../use-highlights'

// ── Boundaries ───────────────────────────────────────────────────────────────

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

// ── Fixtures ─────────────────────────────────────────────────────────────────

const YELLOW = 'fffe00'
const GREEN = '5dff79'
const BLUE = '00d6ff'

const scope: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }
const options = { versionId: 111, book: 'JHN', chapter: '3' }
const userId = 'user-1'

function highlight(passageId: string, color: string, versionId = scope.versionId): Highlight {
  return { version_id: versionId, passage_id: passageId, color }
}

function collection(data: Highlight[]): Result<Collection<Highlight>, HighlightsApiError> {
  return { ok: true, value: { data, next_page_token: null } }
}

function apiError(error: HighlightsApiError): Result<never, HighlightsApiError> {
  return { ok: false, error }
}

const transient = (status?: number, message = 'boom') =>
  apiError({ kind: 'transient', ...(status === undefined ? {} : { status }), message })
const authError = (status: 401 | 403 = 401) =>
  apiError({ kind: 'auth', status, message: 'unauthorized' })

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void }

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

type AuthShape = Partial<AuthContextValue> | null

const signedIn: AuthShape = {
  isAuthenticated: true,
  accessToken: 'token-1',
  userInfo: { id: userId },
  isLoading: false,
}

const signedOut: AuthShape = {
  isAuthenticated: false,
  accessToken: null,
  userInfo: null,
  isLoading: false,
}

/** Signed in, `userInfo` seeded from cache, but `loadTokens()` has not resolved. */
const tokenLoading: AuthShape = {
  isAuthenticated: false,
  accessToken: null,
  userInfo: { id: userId },
  isLoading: true,
}

const refreshNow = jest.fn(async () => undefined)

/**
 * The app asked for `highlights` but the user denied it — or the SDK never
 * learned either way. Either way the fetch is still mounted; see
 * `shouldFetchHighlights`.
 */
const signedInWithoutPermission: AuthShape = {
  ...signedIn,
  requestedPermissions: [],
}

// Hoisted rather than built per render, so a test can assert on it and can gate
// it on a deferred promise.
const ensureFreshToken = jest.fn(async () => undefined)

/**
 * Hoisted for the same reason. The default implementation mirrors the real
 * accessor against the *current* auth value, so identity/token transitions via
 * `setAuth` flow through; tests override it to exercise `refresh-failed`.
 */
const getAccessToken = jest.fn<Promise<AccessTokenResult>, []>()

function defaultGetAccessToken(): Promise<AccessTokenResult> {
  const token = currentAuth?.accessToken ?? null
  return Promise.resolve(
    token === null
      ? { status: 'unavailable', reason: 'signed-out' }
      : { status: 'ok', token, userId: currentAuth?.userInfo?.id ?? null },
  )
}

function authValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    isAuthenticated: false,
    accessToken: null,
    userInfo: null,
    error: null,
    signIn: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    refreshNow,
    ensureFreshToken,
    getAccessToken,
    isLoading: false,
    // The default for every existing case: these tests exercise the fetch, so
    // the app must have asked for the permission that mounts it.
    requestedPermissions: ['highlights'],
    // `grantedPermissions: null` is deliberate — the fetch gates on what was
    // *requested*, so an unknown grant must still fetch. See the gate note in
    // `shouldFetchHighlights`.
    grantedPermissions: null,
    hasPermission: jest.fn(() => false),
    invalidatePermissions: jest.fn(),
    requestPermissions: jest.fn(),
    ...overrides,
  }
}

// `renderHook`'s `rerender` re-supplies hook props but keeps the original
// wrapper, so auth-state transitions (the token-loading window, sign-out
// mid-write) swap this value and re-render rather than remounting — a remount
// would lose the in-flight write under test.
let currentAuth: AuthShape = signedIn

function Wrapper({ children }: { children: ReactNode }) {
  const inner =
    currentAuth === null ? (
      children
    ) : (
      <AuthContext.Provider value={authValue(currentAuth)}>{children}</AuthContext.Provider>
    )
  return (
    <YouVersionContext.Provider
      value={{ appKey: 'app-key', apiHost: 'api.youversion.com', installationId: 'install-1' }}
    >
      {inner}
    </YouVersionContext.Provider>
  )
}

function renderUseHighlights(auth: AuthShape = signedIn, initialProps = options) {
  currentAuth = auth
  return renderHook((props: typeof options) => useHighlights(props), {
    wrapper: Wrapper,
    initialProps,
  })
}

/** Move to a new auth state without remounting the hook. */
function setAuth(rerender: (props: typeof options) => void, auth: AuthShape): void {
  currentAuth = auth
  act(() => {
    rerender({ ...options })
  })
}

function seedCache(highlights: Highlight[], forUser = userId, forScope = scope) {
  mockMmkv.set(highlightsCacheKey(forUser, forScope), JSON.stringify(highlights))
}

/**
 * Cache and server agree — the steady state. Seeding only the cache lets the
 * mount fetch (which defaults to an empty collection) legitimately wipe it,
 * which is right behaviour but the wrong starting point for most tests.
 */
function seedServer(highlights: Highlight[]) {
  seedCache(highlights)
  mockGetHighlights.mockResolvedValue(collection(highlights))
}

function readCache(forUser = userId, forScope = scope): Highlight[] | null {
  const raw = mockMmkv.get(highlightsCacheKey(forUser, forScope))
  return raw === undefined ? null : (JSON.parse(raw) as Highlight[])
}

function colorsOf(result: UseHighlightsResult): Record<string, string> {
  return Object.fromEntries(result.highlights.map((h) => [h.passage_id, h.color]))
}

let appStateListener: ((state: AppStateStatus) => void) | null = null

beforeEach(() => {
  mockMmkv.clear()
  jest.clearAllMocks()
  // `clearAllMocks` clears calls but NOT queued `mockResolvedValueOnce` values,
  // so an unconsumed queue would leak into the next test. Reset these three
  // explicitly rather than `resetAllMocks`, which would also wipe the MMKV fake.
  mockGetHighlights.mockReset()
  mockCreateHighlight.mockReset()
  mockDeleteHighlight.mockReset()
  ensureFreshToken.mockReset()
  ensureFreshToken.mockResolvedValue(undefined)
  getAccessToken.mockReset()
  getAccessToken.mockImplementation(defaultGetAccessToken)
  mockGetHighlights.mockResolvedValue(collection([]))
  mockCreateHighlight.mockResolvedValue({ ok: true, value: highlight('JHN.3.16', YELLOW) })
  mockDeleteHighlight.mockResolvedValue({ ok: true, value: undefined })
  appStateListener = null
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void
    return { remove: jest.fn() }
  })
})

// ── AC 1: instant mount ──────────────────────────────────────────────────────

describe('instant mount from cache', () => {
  it('returns cached highlights on the FIRST render, before any effect runs', async () => {
    seedCache([highlight('JHN.3.16', 'FFFE00'), highlight('JHN.3.20-21', GREEN)])

    // renderHook wraps in act(), which flushes effects — so capture the value
    // during render instead. The first entry is what the reader would paint on
    // its very first frame.
    const renders: UseHighlightsResult[] = []
    const fetchesAtRender: number[] = []
    function Probe() {
      fetchesAtRender.push(mockGetHighlights.mock.calls.length)
      renders.push(useHighlights(options))
      return <Text>probe</Text>
    }

    currentAuth = signedIn
    render(
      <Wrapper>
        <Probe />
      </Wrapper>,
    )

    const first = renders[0]
    expect(first).toBeDefined()
    expect(colorsOf(first as UseHighlightsResult)).toEqual({
      'JHN.3.16': YELLOW, // normalized to lowercase on projection
      'JHN.3.20': GREEN, // the cached range expands per verse
      'JHN.3.21': GREEN,
    })
    // That frame was pure cache: no GET had been issued when it was produced.
    expect(fetchesAtRender[0]).toBe(0)

    // These assertions are deliberately pre-flush; drain the mount fetch so its
    // state update lands inside act().
    await act(async () => {
      await Promise.resolve()
    })
  })

  it('starts empty with no cache and never reports a loading state that hides data', async () => {
    const { result } = renderUseHighlights()
    expect(result.current.highlights).toEqual([])
    expect(result.current.error).toBeNull()

    // These assertions are deliberately pre-flush; drain the mount fetch so its
    // state update lands inside act().
    await act(async () => {
      await Promise.resolve()
    })
  })

  it('reports the scope it is serving', async () => {
    const { result } = renderUseHighlights()
    expect(result.current.scope).toEqual(scope)

    // These assertions are deliberately pre-flush; drain the mount fetch so its
    // state update lands inside act().
    await act(async () => {
      await Promise.resolve()
    })
  })

  it('does not read the cache when signed out', () => {
    seedCache([highlight('JHN.3.16', YELLOW)])
    const { result } = renderUseHighlights(signedOut)
    expect(result.current.highlights).toEqual([])
  })
})

// ── Fetch / reconcile ────────────────────────────────────────────────────────

describe('fetching server truth', () => {
  it('scopes the GET to the chapter and rewrites the cache on success', async () => {
    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockGetHighlights).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.3',
    })
    expect(result.current.highlights).toEqual([])

    mockGetHighlights.mockResolvedValue(collection([highlight('JHN.3.16', YELLOW)]))
    await act(async () => {
      await result.current.refresh()
    })

    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
    expect(readCache()).toEqual([highlight('JHN.3.16', YELLOW)])
  })

  it('keeps rendering cached data when the fetch fails (stale-while-error)', async () => {
    seedCache([highlight('JHN.3.16', YELLOW)])
    mockGetHighlights.mockResolvedValue(transient(500))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
    expect(result.current.error).toEqual({ reason: 'transient', message: 'boom' })
  })

  it('classifies a fetch 401 as auth without refreshing or retrying', async () => {
    mockGetHighlights.mockResolvedValue(authError())

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.error).toEqual({ reason: 'auth', message: 'unauthorized' })
    expect(refreshNow).not.toHaveBeenCalled()
    expect(mockGetHighlights).toHaveBeenCalledTimes(1)
  })

  it('does not fetch while signed out', async () => {
    renderUseHighlights(signedOut)
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetHighlights).not.toHaveBeenCalled()
  })

  it('does not fetch when no auth is configured at all', async () => {
    const { result } = renderUseHighlights(null)
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetHighlights).not.toHaveBeenCalled()
    expect(result.current.highlights).toEqual([])
  })

  it('does not fetch when the app never requested the highlights permission', async () => {
    const { result } = renderUseHighlights(signedInWithoutPermission)
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetHighlights).not.toHaveBeenCalled()
    expect(result.current.highlights).toEqual([])
    expect(result.current.isRefreshing).toBe(false)
  })

  it('still paints the cache when the permission was not requested', async () => {
    seedCache([highlight('JHN.3.16', YELLOW)])
    const { result } = renderUseHighlights(signedInWithoutPermission)
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetHighlights).not.toHaveBeenCalled()
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
  })

  it('does not fetch on an explicit refresh when the permission was not requested', async () => {
    const { result } = renderUseHighlights(signedInWithoutPermission)
    await act(async () => {
      await result.current.refresh()
    })
    expect(mockGetHighlights).not.toHaveBeenCalled()
  })

  it('drops a late response for a scope the reader has left', async () => {
    const pending = deferred<Result<Collection<Highlight>, HighlightsApiError>>()
    mockGetHighlights.mockReturnValueOnce(pending.promise)

    const { result, rerender } = renderUseHighlights()

    rerender({ versionId: 111, book: 'JHN', chapter: '4' })
    expect(result.current.scope.chapter).toBe('4')

    await act(async () => {
      pending.resolve(collection([highlight('JHN.3.16', YELLOW)]))
      await pending.promise
    })

    // Chapter 3's data must not paint chapter 4, nor land in chapter 4's cache.
    expect(result.current.highlights).toEqual([])
    expect(readCache(userId, { versionId: 111, book: 'JHN', chapter: '4' })).not.toContainEqual(
      highlight('JHN.3.16', YELLOW),
    )
  })

  it('repaints instantly from cache when the chapter changes', async () => {
    seedCache([highlight('JHN.4.1', BLUE)], userId, { versionId: 111, book: 'JHN', chapter: '4' })
    const { result, rerender } = renderUseHighlights()

    rerender({ versionId: 111, book: 'JHN', chapter: '4' })

    expect(colorsOf(result.current)).toEqual({ 'JHN.4.1': BLUE })

    // These assertions are deliberately pre-flush; drain the mount fetch so its
    // state update lands inside act().
    await act(async () => {
      await Promise.resolve()
    })
  })

  it('issues a Highlights Refresh GET when the chapter changes', async () => {
    const { rerender } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })
    mockGetHighlights.mockClear()

    rerender({ versionId: 111, book: 'JHN', chapter: '4' })
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockGetHighlights).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.4',
    })
  })

  it('reconciles a refresh that lands mid-write instead of clobbering the overlay', async () => {
    const pendingWrite = deferred<Result<Highlight, HighlightsApiError>>()
    mockCreateHighlight.mockReturnValueOnce(pendingWrite.promise)

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: Promise<HighlightWriteOutcome> | undefined
    await act(async () => {
      outcome = result.current.apply(YELLOW, [16])
      await Promise.resolve()
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })

    // A refresh lands while the POST is still open. The server has not seen the
    // write yet, so it reports nothing for verse 16 — the optimistic paint must
    // survive it.
    mockGetHighlights.mockResolvedValue(collection([]))
    await act(async () => {
      await result.current.refresh()
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })

    // Once the write settles and the server catches up, the overlay retires and
    // the same color is now server truth rather than optimism.
    mockGetHighlights.mockResolvedValue(collection([highlight('JHN.3.16', YELLOW)]))
    await act(async () => {
      pendingWrite.resolve({ ok: true, value: highlight('JHN.3.16', YELLOW) })
      await outcome
      await Promise.resolve()
    })

    expect(await outcome).toEqual({ status: 'ok', verses: [16] })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
  })

  it('clears isRefreshing when signing out abandons an in-flight fetch', async () => {
    const pending = deferred<Result<Collection<Highlight>, HighlightsApiError>>()
    mockGetHighlights.mockReturnValueOnce(pending.promise)

    const { result, rerender } = renderUseHighlights()
    expect(result.current.isRefreshing).toBe(true)

    // Signing out abandons the fetch, and no replacement starts — nothing else
    // would ever clear the flag.
    setAuth(rerender, signedOut)
    expect(result.current.isRefreshing).toBe(false)

    await act(async () => {
      pending.resolve(collection([]))
      await pending.promise
    })
    expect(result.current.isRefreshing).toBe(false)
  })

  it('clears isRefreshing when the permission gate closes on an in-flight fetch', async () => {
    const pending = deferred<Result<Collection<Highlight>, HighlightsApiError>>()
    mockGetHighlights.mockReturnValueOnce(pending.promise)

    const { result, rerender } = renderUseHighlights()
    expect(result.current.isRefreshing).toBe(true)

    // Revoking the request mid-fetch abandons the in-flight promise, so its
    // `finally` no longer owns the flag. Nothing else would clear it.
    setAuth(rerender, signedInWithoutPermission)
    expect(result.current.isRefreshing).toBe(false)

    await act(async () => {
      pending.resolve(collection([]))
      await pending.promise
    })
    expect(result.current.isRefreshing).toBe(false)
  })

  it('shares one in-flight request between concurrent refresh calls', async () => {
    const pending = deferred<Result<Collection<Highlight>, HighlightsApiError>>()
    mockGetHighlights.mockReturnValueOnce(pending.promise)

    const { result } = renderUseHighlights()
    expect(result.current.isRefreshing).toBe(true)

    await act(async () => {
      const a = result.current.refresh()
      const b = result.current.refresh()
      pending.resolve(collection([]))
      await Promise.all([a, b])
    })

    expect(mockGetHighlights).toHaveBeenCalledTimes(1)
    expect(result.current.isRefreshing).toBe(false)
  })
})

describe('Highlights Refresh on AppState', () => {
  it('runs a Highlights Refresh when the app returns to active, and not on the way out', async () => {
    renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })
    mockGetHighlights.mockClear()

    act(() => appStateListener?.('background'))
    expect(mockGetHighlights).not.toHaveBeenCalled()

    await act(async () => {
      appStateListener?.('active')
      await Promise.resolve()
    })

    expect(mockGetHighlights).toHaveBeenCalledTimes(1)
    expect(mockGetHighlights).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.3',
    })
  })

  it('registers a "change" listener on mount and removes it on unmount', async () => {
    const remove = jest.fn()
    jest.mocked(AppState.addEventListener).mockImplementation((_event, listener) => {
      appStateListener = listener as (state: AppStateStatus) => void
      return { remove }
    })

    const { unmount } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(remove).not.toHaveBeenCalled()

    unmount()
    expect(remove).toHaveBeenCalledTimes(1)
  })
})

// ── AC 2 / 3: optimistic apply ───────────────────────────────────────────────

describe('apply', () => {
  it('paints synchronously, then reconciles against the server and rewrites the cache', async () => {
    const pendingWrite = deferred<Result<Highlight, HighlightsApiError>>()
    mockCreateHighlight.mockReturnValueOnce(pendingWrite.promise)

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      outcome = result.current.apply(YELLOW, [16, 17])
    })

    // Painted before the request resolved.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW, 'JHN.3.17': YELLOW })

    mockGetHighlights.mockResolvedValue(
      collection([highlight('JHN.3.16', YELLOW), highlight('JHN.3.17', YELLOW)]),
    )

    await act(async () => {
      pendingWrite.resolve({ ok: true, value: highlight('JHN.3.16-17', YELLOW) })
      await outcome
      await Promise.resolve()
    })

    expect(await outcome).toEqual({ status: 'ok', verses: [16, 17] })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW, 'JHN.3.17': YELLOW })
    expect(readCache()).toEqual([highlight('JHN.3.16', YELLOW), highlight('JHN.3.17', YELLOW)])
  })

  it('resolves the token after the paint and before the POST', async () => {
    const tokenGate = deferred<AccessTokenResult>()
    getAccessToken.mockReturnValueOnce(tokenGate.promise)

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      outcome = result.current.apply(YELLOW, [16])
    })

    // Painted while the accessor is still out. A token round-trip in front of
    // the claim would leave the verse unpainted every time a refresh was due,
    // which is the whole reason it lives here (ADR 0016).
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
    expect(mockCreateHighlight).not.toHaveBeenCalled()

    await act(async () => {
      tokenGate.resolve({ status: 'ok', token: 'token-1', userId })
      await outcome
    })

    // And the POST did wait for it. An expired token 401s, a 401 classifies as
    // `auth`, and `useHighlightPermissionFlow` reads `auth` as a stale grant —
    // so the user would be asked to grant a permission they already granted.
    expect(mockCreateHighlight).toHaveBeenCalledTimes(1)
    expect(getAccessToken).toHaveBeenCalledTimes(1)
  })

  // The reason `getAccessToken` exists: an expired token plus a failing token
  // endpoint used to send the write out anyway, 401, classify as `auth`, and
  // `useHighlightPermissionFlow` would invalidate a perfectly valid grant.
  it('fails as transient with no request when the token refresh fails', async () => {
    seedServer([highlight('JHN.3.16', GREEN)])
    getAccessToken.mockResolvedValue({ status: 'unavailable', reason: 'refresh-failed' })

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    // `transient` — never `auth` (which invalidates the grant) and never
    // `not-signed-in` (which prompts sign-in): the session is intact.
    expect(outcome).toEqual({
      status: 'error',
      reason: 'transient',
      message: expect.stringContaining('refresh'),
      failedVerses: [16],
      succeededVerses: [],
    })
    // The doomed request never went out, and the paint reverted to server truth.
    expect(mockCreateHighlight).not.toHaveBeenCalled()
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
  })

  it('maps an accessor signed-out (session cleared mid-write) to not-signed-in', async () => {
    seedServer([highlight('JHN.3.16', GREEN)])
    // Signed in per context, but the refresh found the token revoked and
    // cleared the session before the write was sent.
    getAccessToken.mockResolvedValue({ status: 'unavailable', reason: 'signed-out' })

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    expect(outcome).toMatchObject({ status: 'error', reason: 'not-signed-in', failedVerses: [16] })
    expect(mockCreateHighlight).not.toHaveBeenCalled()
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
  })

  it('collapses contiguous verses into one ranged POST per run', async () => {
    const { result } = renderUseHighlights()
    await act(async () => {
      await result.current.apply(YELLOW, [16, 17, 18, 20])
    })

    expect(mockCreateHighlight).toHaveBeenCalledTimes(2)
    expect(mockCreateHighlight).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.3.16-18',
      color: YELLOW,
    })
    expect(mockCreateHighlight).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.3.20',
      color: YELLOW,
    })
  })

  // AC 3
  it('reverts the paint and returns a typed error when the server rejects the write', async () => {
    seedServer([highlight('JHN.3.16', GREEN)])
    mockCreateHighlight.mockResolvedValue(transient(422, 'boom'))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    expect(outcome).toEqual({
      status: 'error',
      reason: 'invalid',
      message: 'boom',
      failedVerses: [16],
      succeededVerses: [],
    })
    // Reverted to what the server last said, not to nothing.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
  })

  it('classifies a write 401 as auth without refreshing or retrying', async () => {
    mockCreateHighlight.mockResolvedValue(authError())

    const { result } = renderUseHighlights()
    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    expect(outcome).toMatchObject({ status: 'error', reason: 'auth' })
    expect(mockCreateHighlight).toHaveBeenCalledTimes(1)
    expect(refreshNow).not.toHaveBeenCalled()
  })

  // Without this, the pre-#99 `uuid_parsing` 422 presents as flaky network.
  it('classifies a non-auth 4xx as invalid, not transient', async () => {
    mockCreateHighlight.mockResolvedValue(transient(422, 'uuid_parsing'))

    const { result } = renderUseHighlights()
    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    expect(outcome).toMatchObject({ status: 'error', reason: 'invalid' })
  })

  // A 5xx and an unreachable network are the same thing to the caller: the write
  // did not land, and retrying it later may.
  it('parks a 5xx and a network failure alike', async () => {
    mockCreateHighlight.mockResolvedValueOnce(transient(503))
    const { result } = renderUseHighlights()

    let first: HighlightWriteOutcome | undefined
    await act(async () => {
      first = await result.current.apply(YELLOW, [16])
    })
    expect(first).toEqual({ status: 'queued', verses: [16] })

    mockCreateHighlight.mockResolvedValueOnce(transient(undefined, 'Network request failed'))
    let second: HighlightWriteOutcome | undefined
    await act(async () => {
      second = await result.current.apply(YELLOW, [17])
    })
    expect(second).toEqual({ status: 'queued', verses: [17] })
  })

  it('is a noop for an empty verse list, with no request', async () => {
    const { result } = renderUseHighlights()
    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [])
    })

    expect(outcome).toEqual({ status: 'noop' })
    expect(mockCreateHighlight).not.toHaveBeenCalled()
  })
})

// ── Partial batches ──────────────────────────────────────────────────────────

describe('partial batches', () => {
  it('retains succeeded verses, reverts rejected ones, and reports both', async () => {
    mockCreateHighlight
      .mockResolvedValueOnce({ ok: true, value: highlight('JHN.3.16-17', YELLOW) })
      .mockResolvedValueOnce(transient(422, 'boom'))

    const { result } = renderUseHighlights()
    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16, 17, 20])
    })

    expect(outcome).toEqual({
      status: 'error',
      reason: 'invalid',
      message: 'boom',
      failedVerses: [20],
      succeededVerses: [16, 17],
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW, 'JHN.3.17': YELLOW })
  })

  it('resolves mixed failure reasons as auth > invalid > transient', async () => {
    mockCreateHighlight
      .mockResolvedValueOnce(transient(500, 'five hundred'))
      .mockResolvedValueOnce(transient(422, 'bad passage'))
      .mockResolvedValueOnce(authError(403))

    const { result } = renderUseHighlights()
    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [1, 3, 5])
    })

    expect(outcome).toMatchObject({ reason: 'auth', message: 'unauthorized' })
  })

  it('prefers invalid over transient when no auth failure is present', async () => {
    mockCreateHighlight
      .mockResolvedValueOnce(transient(500, 'five hundred'))
      .mockResolvedValueOnce(transient(400, 'bad passage'))

    const { result } = renderUseHighlights()
    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [1, 3])
    })

    expect(outcome).toMatchObject({ reason: 'invalid', message: 'bad passage' })
  })
})

// ── AC 4 / 7: ownership and serialization ────────────────────────────────────

describe('overlapping writes', () => {
  it('serializes network writes while painting both immediately', async () => {
    const first = deferred<Result<Highlight, HighlightsApiError>>()
    mockCreateHighlight.mockReturnValueOnce(first.promise)

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let a: Promise<HighlightWriteOutcome> | undefined
    let b: Promise<HighlightWriteOutcome> | undefined
    await act(async () => {
      a = result.current.apply(YELLOW, [16])
      b = result.current.apply(GREEN, [20])
      // Let the head of the chain reach the network; the tail stays queued
      // behind the unresolved deferred.
      await Promise.resolve()
    })

    // Both painted; only the first has reached the network.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW, 'JHN.3.20': GREEN })
    expect(mockCreateHighlight).toHaveBeenCalledTimes(1)

    await act(async () => {
      first.resolve({ ok: true, value: highlight('JHN.3.16', YELLOW) })
      await Promise.all([a, b])
    })

    expect(mockCreateHighlight).toHaveBeenCalledTimes(2)
  })

  // AC 4 — ownership, end to end. A settling write only touches entries still
  // asking for what it sent, so a rejection cannot revert a newer intent.
  it('a rejected older write does not wipe the color a newer write painted', async () => {
    const slowYellow = deferred<Result<Highlight, HighlightsApiError>>()
    mockCreateHighlight.mockReturnValueOnce(slowYellow.promise)

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let yellowOutcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      yellowOutcome = result.current.apply(YELLOW, [16])
    })

    // Let yellow's POST actually go out. Without this it would be superseded
    // before it sends, and the ownership guard below would never be exercised.
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockCreateHighlight).toHaveBeenCalledTimes(1)

    // The user re-taps verse 16 in green before yellow's POST comes back.
    let greenOutcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      greenOutcome = result.current.apply(GREEN, [16])
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })

    await act(async () => {
      slowYellow.resolve(transient(422))
      await yellowOutcome
      await greenOutcome
    })

    // Yellow was rejected, but it no longer owned verse 16 — green survives.
    expect(await yellowOutcome).toMatchObject({ status: 'error', failedVerses: [16] })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
  })
})

// ── AC 5: the vapor fix ──────────────────────────────────────────────────────

describe('reconciling against a stale replica', () => {
  it('does not resurrect a removed highlight when a later GET echoes the deleted color', async () => {
    seedServer([highlight('JHN.3.16', YELLOW)])

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    // The post-settle refetch hits a replica that has not caught up.
    mockGetHighlights.mockResolvedValue(collection([highlight('JHN.3.16', YELLOW)]))

    await act(async () => {
      await result.current.remove(YELLOW, [16])
      await Promise.resolve()
    })

    expect(mockDeleteHighlight).toHaveBeenCalledWith('token-1', 'JHN.3.16', { version_id: 111 })
    expect(result.current.highlights).toEqual([])
  })

  it('retires the remove overlay once the server reports a different color', async () => {
    seedServer([highlight('JHN.3.16', YELLOW)])

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    // Another device set green after our delete landed — newer data, not vapor.
    mockGetHighlights.mockResolvedValue(collection([highlight('JHN.3.16', GREEN)]))

    await act(async () => {
      await result.current.remove(YELLOW, [16])
      await Promise.resolve()
    })

    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
  })
})

// ── remove ───────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('only deletes verses the user currently sees in that color', async () => {
    seedServer([
      highlight('JHN.3.16', YELLOW),
      highlight('JHN.3.17', BLUE),
      highlight('JHN.3.18', YELLOW),
    ])

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.remove(YELLOW, [16, 17, 18])
    })

    expect(outcome).toEqual({ status: 'ok', verses: [16, 18] })
    // One DELETE per verse, never a range — and nothing for the blue verse.
    expect(mockDeleteHighlight).toHaveBeenCalledTimes(2)
    expect(mockDeleteHighlight).toHaveBeenCalledWith('token-1', 'JHN.3.16', { version_id: 111 })
    expect(mockDeleteHighlight).toHaveBeenCalledWith('token-1', 'JHN.3.18', { version_id: 111 })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.17': BLUE })
  })

  it('is a noop with no request when nothing in the selection matches the color', async () => {
    seedServer([highlight('JHN.3.17', BLUE)])
    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.remove(YELLOW, [16, 17])
    })

    expect(outcome).toEqual({ status: 'noop' })
    expect(mockDeleteHighlight).not.toHaveBeenCalled()
  })

  it('restores the highlight when the server rejects the delete', async () => {
    seedServer([highlight('JHN.3.16', YELLOW)])
    mockDeleteHighlight.mockResolvedValue(transient(422))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.remove(YELLOW, [16])
    })

    expect(outcome).toMatchObject({ status: 'error', failedVerses: [16] })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
  })

  it('targets optimistic paint too, not just server truth', async () => {
    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.apply(GREEN, [16])
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.remove(GREEN, [16])
    })

    expect(outcome).toEqual({ status: 'ok', verses: [16] })
  })

  // A toggle that applies and un-applies within one handler never yields to
  // React, so nothing has re-rendered and the ref-sync effect has not run. If
  // the selection were read from the last committed render, this would no-op and
  // strand the highlight the apply just painted.
  //
  // Neither request goes out: the two writes cancel each other in the queue
  // before either reaches the send path, so the server is never given a
  // highlight only to be asked to delete it again.
  it('sees a write made earlier in the same tick, before any re-render', async () => {
    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let applied: Promise<HighlightWriteOutcome> | undefined
    let removed: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      applied = result.current.apply(GREEN, [16])
      removed = result.current.remove(GREEN, [16])
    })

    await act(async () => {
      await applied
      await removed
    })

    // Both discriminate: had the remove read the last committed render it would
    // target no verses, leaving the apply's paint on 16 and its entry alive to
    // send.
    expect(result.current.highlights).toEqual([])
    expect(mockCreateHighlight).not.toHaveBeenCalled()
    expect(mockDeleteHighlight).not.toHaveBeenCalled()
  })
})

// ── The palette ──────────────────────────────────────────────────────────────

describe('color validation', () => {
  it('rejects a non-swatch color from apply with no paint and no request', async () => {
    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply('ff0000', [16])
    })

    expect(outcome).toMatchObject({ status: 'error', reason: 'invalid', failedVerses: [16] })
    expect(result.current.highlights).toEqual([])
    expect(mockCreateHighlight).not.toHaveBeenCalled()
  })

  it('clears valid non-palette hex from remove', async () => {
    seedServer([highlight('JHN.3.16', 'ff0000')])
    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.remove('ff0000', [16])
    })

    expect(outcome).toMatchObject({ status: 'ok', verses: [16] })
    expect(mockDeleteHighlight).toHaveBeenCalled()
    expect(colorsOf(result.current)).toEqual({})
  })

  it('rejects invalid hex from remove with no request', async () => {
    seedServer([highlight('JHN.3.16', 'fffe00')])
    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.remove('gg0000', [16])
    })

    expect(outcome).toMatchObject({ status: 'error', reason: 'invalid' })
    expect(mockDeleteHighlight).not.toHaveBeenCalled()
  })

  it('accepts a swatch given in uppercase', async () => {
    const { result } = renderUseHighlights()
    await act(async () => {
      await result.current.apply('FFFE00', [16])
    })

    expect(mockCreateHighlight).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.3.16',
      color: YELLOW,
    })
  })
})

// ── AC 6: signed out, and the token-loading window ───────────────────────────

describe('auth states', () => {
  it('returns a typed not-signed-in failure without touching state', async () => {
    const { result } = renderUseHighlights(signedOut)

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    expect(outcome).toEqual({
      status: 'error',
      reason: 'not-signed-in',
      message: expect.stringContaining('Not signed in'),
      failedVerses: [16],
      succeededVerses: [],
    })
    expect(result.current.highlights).toEqual([])
    expect(mockCreateHighlight).not.toHaveBeenCalled()
  })

  it('behaves as signed out when no auth is configured', async () => {
    const { result } = renderUseHighlights(null)

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    expect(outcome).toMatchObject({ reason: 'not-signed-in' })
  })

  // The exposure the hold exists for: reporting `not-signed-in` here would send
  // C3 off to prompt a user who is already signed in.
  it('holds a write through the token-loading window instead of failing it', async () => {
    seedCache([highlight('JHN.3.16', GREEN)])
    const { result, rerender } = renderUseHighlights(tokenLoading)

    // Cache paints even though `isAuthenticated` is still false.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })

    let outcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      outcome = result.current.apply(YELLOW, [16])
    })

    // Painted, but held: no request yet, and no premature failure.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
    expect(mockCreateHighlight).not.toHaveBeenCalled()

    // The token arrives. `isLoading` is still true — the hold must release on
    // the token, not on loading clearing.
    setAuth(rerender, { ...tokenLoading, accessToken: 'token-1' })

    await act(async () => {
      await outcome
    })

    expect(mockCreateHighlight).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.3.16',
      color: YELLOW,
    })
    expect(await outcome).toEqual({ status: 'ok', verses: [16] })
  })

  it('releases the hold as a not-signed-in failure when auth settles with no token', async () => {
    seedCache([highlight('JHN.3.16', GREEN)])
    const { result, rerender } = renderUseHighlights(tokenLoading)

    let outcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      outcome = result.current.apply(YELLOW, [16])
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })

    setAuth(rerender, { ...tokenLoading, isLoading: false })

    await act(async () => {
      await outcome
    })

    expect(await outcome).toMatchObject({ reason: 'not-signed-in', failedVerses: [16] })
    // The optimistic paint is reverted, not left stranded.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
    expect(mockCreateHighlight).not.toHaveBeenCalled()
  })

  it('lets remove target cache-painted verses during the token-loading window', async () => {
    seedCache([highlight('JHN.3.16', YELLOW)])
    const { result, rerender } = renderUseHighlights(tokenLoading)

    let outcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      // Guarding on `isAuthenticated` (as web does) would silently no-op this.
      outcome = result.current.remove(YELLOW, [16])
    })
    expect(result.current.highlights).toEqual([])

    setAuth(rerender, { ...tokenLoading, accessToken: 'token-1' })

    await act(async () => {
      await outcome
    })

    expect(await outcome).toEqual({ status: 'ok', verses: [16] })
    expect(mockDeleteHighlight).toHaveBeenCalledTimes(1)
  })

  // A queued write must not be issued under whoever happens to be signed in when
  // its turn comes: `runWrite` reads the current token by design (a mid-write
  // refresh must not fail the write), so nothing but the identity guard stops
  // one user's intent from mutating another user's highlights server-side.
  it('abandons a queued write when a different user signs in before it runs', async () => {
    const heldWrite = deferred<Result<Highlight, HighlightsApiError>>()
    mockCreateHighlight.mockReturnValueOnce(heldWrite.promise)

    const { result, rerender } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let first: Promise<HighlightWriteOutcome> | undefined
    let queued: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      first = result.current.apply(YELLOW, [16])
    })
    // Let the first write reach the network, where it hangs — that is what holds
    // the chain open across the identity change.
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockCreateHighlight).toHaveBeenCalledTimes(1)

    act(() => {
      queued = result.current.apply(GREEN, [17])
    })

    setAuth(rerender, {
      isAuthenticated: true,
      accessToken: 'token-2',
      userInfo: { id: 'user-2' },
      isLoading: false,
    })

    await act(async () => {
      heldWrite.resolve({ ok: true, value: highlight('JHN.3.16', YELLOW) })
      await first
      await queued
    })

    expect(await queued).toEqual({
      status: 'error',
      reason: 'not-signed-in',
      message: expect.stringContaining('Not signed in'),
      failedVerses: [17],
      succeededVerses: [],
    })
    // Only the write that was already on the wire under user-1's token ran.
    expect(mockCreateHighlight).toHaveBeenCalledTimes(1)
    expect(mockCreateHighlight).not.toHaveBeenCalledWith('token-2', expect.anything())
  })

  // The narrow window the previous test cannot reach: the provider writes its
  // token and identity refs synchronously on sign-in, while the identity this
  // hook compares against is synced from a passive effect a render later. A
  // sign-in landing while the write awaits the accessor therefore hands back the
  // new user's token under the old user's rendered identity — so the guard has
  // to believe the identity that came back WITH the token.
  it('abandons a write when the accessor returns a token owned by a different user', async () => {
    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    getAccessToken.mockResolvedValueOnce({
      status: 'ok',
      token: 'token-2',
      userId: 'user-2',
    })

    let outcome: Promise<HighlightWriteOutcome> | undefined
    await act(async () => {
      outcome = result.current.apply(YELLOW, [16])
      await outcome
    })

    expect(await outcome).toMatchObject({
      status: 'error',
      reason: 'not-signed-in',
      failedVerses: [16],
    })
    expect(mockCreateHighlight).not.toHaveBeenCalled()
    // The optimistic paint is reverted, not left stranded on the departed user's
    // chapter.
    expect(colorsOf(result.current)).toEqual({})
  })

  it('abandons a queued remove rather than deleting the new user’s highlights', async () => {
    seedServer([highlight('JHN.3.16', YELLOW), highlight('JHN.3.17', YELLOW)])
    const heldWrite = deferred<Result<undefined, HighlightsApiError>>()
    mockDeleteHighlight.mockReturnValueOnce(heldWrite.promise)

    const { result, rerender } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let first: Promise<HighlightWriteOutcome> | undefined
    let queued: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      first = result.current.remove(YELLOW, [16])
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockDeleteHighlight).toHaveBeenCalledTimes(1)

    act(() => {
      queued = result.current.remove(YELLOW, [17])
    })

    setAuth(rerender, {
      isAuthenticated: true,
      accessToken: 'token-2',
      userInfo: { id: 'user-2' },
      isLoading: false,
    })

    await act(async () => {
      heldWrite.resolve({ ok: true, value: undefined })
      await first
      await queued
    })

    expect(await queued).toMatchObject({ reason: 'not-signed-in', failedVerses: [17] })
    expect(mockDeleteHighlight).toHaveBeenCalledTimes(1)
    expect(mockDeleteHighlight).not.toHaveBeenCalledWith('token-2', expect.anything())
  })

  // The counterpart: same user, new token. Capturing the token at claim time
  // instead of reading it here would fail this write for no reason.
  it('runs a queued write under a refreshed token for the same user', async () => {
    const heldWrite = deferred<Result<Highlight, HighlightsApiError>>()
    mockCreateHighlight.mockReturnValueOnce(heldWrite.promise)

    const { result, rerender } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let first: Promise<HighlightWriteOutcome> | undefined
    let queued: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      first = result.current.apply(YELLOW, [16])
      queued = result.current.apply(GREEN, [17])
    })

    setAuth(rerender, { ...signedIn, accessToken: 'token-refreshed' })

    await act(async () => {
      heldWrite.resolve({ ok: true, value: highlight('JHN.3.16', YELLOW) })
      await first
      await queued
    })

    expect(await queued).toEqual({ status: 'ok', verses: [17] })
    expect(mockCreateHighlight).toHaveBeenLastCalledWith('token-refreshed', {
      version_id: 111,
      passage_id: 'JHN.3.17',
      color: GREEN,
    })
  })

  it('does not repopulate the cache when sign-out lands between settle and refetch', async () => {
    seedCache([highlight('JHN.3.16', GREEN)])
    const pendingWrite = deferred<Result<Highlight, HighlightsApiError>>()
    mockCreateHighlight.mockReturnValueOnce(pendingWrite.promise)

    const { result, rerender } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      outcome = result.current.apply(YELLOW, [16])
    })

    // AuthProvider.clearAuthState() has just emptied the highlights cache.
    mockMmkv.clear()
    setAuth(rerender, signedOut)

    mockGetHighlights.mockResolvedValue(collection([highlight('JHN.3.16', YELLOW)]))
    await act(async () => {
      pendingWrite.resolve({ ok: true, value: highlight('JHN.3.16', YELLOW) })
      await outcome
      await Promise.resolve()
    })

    expect(readCache()).toBeNull()
  })
})

// ── error is fetch-only ──────────────────────────────────────────────────────

describe('error surface', () => {
  it('never lets a failed write evict a fetch error that is still true', async () => {
    seedCache([highlight('JHN.3.16', GREEN)])
    mockGetHighlights.mockResolvedValue(transient(500, 'fetch died'))
    mockCreateHighlight.mockResolvedValue(transient(422, 'write died'))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.error).toEqual({ reason: 'transient', message: 'fetch died' })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [17])
      await Promise.resolve()
    })

    // The write reported through its return value only.
    expect(outcome).toMatchObject({ message: 'write died' })
    expect(result.current.error).toEqual({ reason: 'transient', message: 'fetch died' })
  })

  it('clears a stale fetch error once a fetch succeeds', async () => {
    mockGetHighlights.mockResolvedValueOnce(transient(500))
    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.error).not.toBeNull()

    mockGetHighlights.mockResolvedValue(collection([]))
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.error).toBeNull()
  })
})

// ── Degraded: no user id ─────────────────────────────────────────────────────

describe('missing user id', () => {
  it('runs cache-less with a single dev warning', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const noUserId: AuthShape = {
      isAuthenticated: true,
      accessToken: 'token-1',
      userInfo: { name: 'Someone' },
      isLoading: false,
    }
    mockGetHighlights.mockResolvedValue(collection([highlight('JHN.3.16', YELLOW)]))

    const { result, unmount } = renderUseHighlights(noUserId)
    await act(async () => {
      await Promise.resolve()
    })

    // Network still paints; only the cache is disabled.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
    expect(mockMmkv.size).toBe(0)
    expect(warn).toHaveBeenCalledTimes(1)

    unmount()
    renderUseHighlights(noUserId)
    await act(async () => {
      await Promise.resolve()
    })
    // Warned once per process, not once per mount.
    expect(warn).toHaveBeenCalledTimes(1)

    warn.mockRestore()
  })

  it('rejects writes when there is no user id to key the cache by', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { result } = renderUseHighlights({
      isAuthenticated: true,
      accessToken: 'token-1',
      userInfo: { name: 'Someone' },
      isLoading: false,
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    expect(outcome).toMatchObject({ reason: 'not-signed-in' })
  })
})
