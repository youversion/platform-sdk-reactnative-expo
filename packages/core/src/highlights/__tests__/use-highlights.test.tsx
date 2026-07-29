import type { Collection, Highlight } from '@youversion/platform-core'
import { act, render, renderHook } from '@testing-library/react-native'
import { AppState, Text, type AppStateStatus } from 'react-native'
import type { ReactNode } from 'react'

import { AuthContext, type AuthContextValue } from '../../auth/auth-context'
import {
  clearGrantedPermissions,
  getGrantedPermissions,
  saveGrantedPermissions,
} from '../../auth/granted-permissions'
import { YouVersionContext } from '../../youversion-context'
import type { Result } from '../../result'
import type { HighlightsApiError } from '../api'
import { highlightsCacheKey, type HighlightScope } from '../constants'
import {
  clearHighlightQueue,
  getPendingOps,
  highlightQueueKey,
  QUEUE_INITIAL_BACKOFF_MS,
  QUEUE_MAX_BACKOFF_MS,
} from '../queue'
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

function authValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    isAuthenticated: false,
    accessToken: null,
    userInfo: null,
    grantedPermissions: null,
    hasPermission: () => false,
    requestPermission: jest.fn(async () => ({ kind: 'cancel' as const })),
    hasPendingHighlightOperations: false,
    discardPendingHighlights: jest.fn(),
    error: null,
    signIn: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    refreshNow,
    isLoading: false,
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

beforeEach(() => {
  mockMmkv.clear()
  // Drops the granted-permissions snapshot cache, which is module state and
  // would otherwise outlive `mockMmkv.clear()`.
  clearGrantedPermissions()
  // Same for the write queue's snapshot cache; this also bumps the generation,
  // so nothing a previous test left in flight can settle into this one.
  clearHighlightQueue()
  jest.clearAllMocks()
  // `clearAllMocks` clears calls but NOT queued `mockResolvedValueOnce` values,
  // so an unconsumed queue would leak into the next test. Reset these three
  // explicitly rather than `resetAllMocks`, which would also wipe the MMKV fake.
  mockGetHighlights.mockReset()
  mockCreateHighlight.mockReset()
  mockDeleteHighlight.mockReset()
  mockGetHighlights.mockResolvedValue(collection([]))
  mockCreateHighlight.mockResolvedValue({ ok: true, value: highlight('JHN.3.16', YELLOW) })
  mockDeleteHighlight.mockResolvedValue({ ok: true, value: undefined })
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

  /**
   * The chapter-change half of "revalidate when it matters". Nothing new was
   * written for it — `identityKey` already carries the scope, so leaving and
   * returning re-runs the fetch effect — but the cache is the thing that could
   * plausibly suppress the second GET, and it must not. A highlight created on
   * another device while the reader was on chapter 4 has to show up on the way
   * back to chapter 3.
   */
  it('re-fetches on every chapter change, including the return trip to a cached chapter', async () => {
    const chapter4: HighlightScope = { versionId: 111, book: 'JHN', chapter: '4' }
    seedServer([highlight('JHN.3.16', YELLOW)])

    const { result, rerender } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetHighlights).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.3',
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })

    // Away to chapter 4.
    mockGetHighlights.mockClear()
    mockGetHighlights.mockResolvedValue(collection([highlight('JHN.4.1', BLUE)]))
    rerender({ versionId: chapter4.versionId, book: chapter4.book, chapter: chapter4.chapter })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockGetHighlights).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.4',
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.4.1': BLUE })

    // Back to chapter 3, which now has a cache entry. Somebody added verse 17
    // elsewhere in the meantime; a cache hit must not stand in for the GET.
    mockGetHighlights.mockClear()
    mockGetHighlights.mockResolvedValue(
      collection([highlight('JHN.3.16', YELLOW), highlight('JHN.3.17', GREEN)]),
    )
    rerender({ ...options })
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockGetHighlights).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.3',
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW, 'JHN.3.17': GREEN })
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
    // the same colour is now server truth rather than optimism.
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

// ── Foreground revalidation ──────────────────────────────────────────────────

describe('revalidating when the app returns to the foreground', () => {
  const appStateMock = AppState.addEventListener as unknown as jest.Mock

  /** The handler from the most recent subscription — the live one. */
  function latestHandler(): (state: AppStateStatus) => void {
    const calls = appStateMock.mock.calls
    const last = calls[calls.length - 1]
    if (last === undefined) {
      throw new Error('useHighlights never subscribed to AppState')
    }
    return last[1] as (state: AppStateStatus) => void
  }

  async function emit(...states: AppStateStatus[]): Promise<void> {
    const handler = latestHandler()
    await act(async () => {
      for (const state of states) {
        handler(state)
      }
      await Promise.resolve()
    })
  }

  it('re-fetches on background → active, picking up a highlight made elsewhere', async () => {
    seedServer([highlight('JHN.3.16', YELLOW)])
    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })

    // Meanwhile, on the YouVersion app: verse 17 gets highlighted green.
    mockGetHighlights.mockClear()
    mockGetHighlights.mockResolvedValue(
      collection([highlight('JHN.3.16', YELLOW), highlight('JHN.3.17', GREEN)]),
    )

    await emit('background', 'active')

    expect(mockGetHighlights).toHaveBeenCalledTimes(1)
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW, 'JHN.3.17': GREEN })
  })

  it('does NOT re-fetch on inactive → active, which is what a consent flow returns as', async () => {
    renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    // `expo-web-browser` (PKCE sign-in, the data-exchange consent page) leaves
    // the app `inactive`, and the permission flow already calls `refresh()` on
    // its own — firing here too would double-fetch on every consent return.
    mockGetHighlights.mockClear()
    await emit('inactive', 'active')

    expect(mockGetHighlights).not.toHaveBeenCalled()
  })

  it('ignores a background → active while signed out', async () => {
    renderUseHighlights(signedOut)
    await act(async () => {
      await Promise.resolve()
    })

    mockGetHighlights.mockClear()
    await emit('background', 'active')

    expect(mockGetHighlights).not.toHaveBeenCalled()
  })

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    const results = appStateMock.mock.results
    const latest = results[results.length - 1]
    expect(latest).toBeDefined()
    const subscription = latest?.value as { remove: jest.Mock }
    expect(subscription.remove).not.toHaveBeenCalled()

    unmount()

    expect(subscription.remove).toHaveBeenCalled()
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

  // AC 3, as amended by the write queue: a transient failure no longer reverts.
  it('keeps the paint and queues the write when the network fails', async () => {
    seedServer([highlight('JHN.3.16', GREEN)])
    mockCreateHighlight.mockResolvedValue(transient(500))

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
      reason: 'transient',
      message: 'boom',
      failedVerses: [16],
      succeededVerses: [],
    })
    // The user's highlight is late, not lost: it stays painted and the retry
    // carries it. Reverting here is what the queue exists to stop.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
    expect(getPendingOps(userId)).toEqual([
      expect.objectContaining({ op: 'apply', color: YELLOW, verses: [16], scope, attempts: 1 }),
    ])
    expect(result.current.hasPendingOperations).toBe(true)
  })

  it('reverts the paint on a permanent rejection instead of queueing it', async () => {
    seedServer([highlight('JHN.3.16', GREEN)])
    mockCreateHighlight.mockResolvedValue(transient(422, 'uuid_parsing'))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.apply(YELLOW, [16])
    })

    // Reverted to what the server last said, not to nothing — and nothing is
    // scheduled, because the identical request would be rejected identically.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
    expect(getPendingOps(userId)).toEqual([])
    expect(result.current.hasPendingOperations).toBe(false)
  })

  it('does not queue an auth failure — the permission prompt owns that one', async () => {
    mockCreateHighlight.mockResolvedValue(authError(403))

    const { result } = renderUseHighlights()
    await act(async () => {
      await result.current.apply(YELLOW, [16])
    })

    expect(getPendingOps(userId)).toEqual([])
    expect(result.current.highlights).toEqual([])
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

  // The ADR 0013 seam. The server outranks the optimistic mirror, so the next
  // tap has to route to the permission prompt instead of failing the same way.
  it('invalidates the highlights grant when a write comes back 401/403', async () => {
    saveGrantedPermissions(userId, ['highlights', 'votd'])
    mockCreateHighlight.mockResolvedValue(authError(403))

    const { result } = renderUseHighlights()
    await act(async () => {
      await result.current.apply(YELLOW, [16])
    })

    expect(getGrantedPermissions(userId)).toEqual(['votd'])
  })

  it('leaves the granted-permissions mirror alone when a write fails for other reasons', async () => {
    saveGrantedPermissions(userId, ['highlights'])
    mockCreateHighlight.mockResolvedValue(transient(500))

    const { result } = renderUseHighlights()
    await act(async () => {
      await result.current.apply(YELLOW, [16])
    })

    expect(getGrantedPermissions(userId)).toEqual(['highlights'])
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

  it('classifies a 5xx and a network failure as transient', async () => {
    mockCreateHighlight.mockResolvedValueOnce(transient(503))
    const { result } = renderUseHighlights()

    let first: HighlightWriteOutcome | undefined
    await act(async () => {
      first = await result.current.apply(YELLOW, [16])
    })
    expect(first).toMatchObject({ reason: 'transient' })

    mockCreateHighlight.mockResolvedValueOnce(transient(undefined, 'Network request failed'))
    let second: HighlightWriteOutcome | undefined
    await act(async () => {
      second = await result.current.apply(YELLOW, [16])
    })
    expect(second).toMatchObject({ reason: 'transient' })
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
  it('retains succeeded verses, queues the failed one, and reports both', async () => {
    mockCreateHighlight
      .mockResolvedValueOnce({ ok: true, value: highlight('JHN.3.16-17', YELLOW) })
      .mockResolvedValueOnce(transient(500))

    const { result } = renderUseHighlights()
    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16, 17, 20])
    })

    expect(outcome).toEqual({
      status: 'error',
      reason: 'transient',
      message: 'boom',
      failedVerses: [20],
      succeededVerses: [16, 17],
    })
    // All three stay painted; only verse 20 still owes the server a request.
    expect(colorsOf(result.current)).toEqual({
      'JHN.3.16': YELLOW,
      'JHN.3.17': YELLOW,
      'JHN.3.20': YELLOW,
    })
    expect(getPendingOps(userId)).toEqual([expect.objectContaining({ verses: [20] })])
  })

  it('queues only the transient half of a mixed failure', async () => {
    mockCreateHighlight
      .mockResolvedValueOnce(transient(500, 'five hundred'))
      .mockResolvedValueOnce(transient(400, 'bad passage'))

    const { result } = renderUseHighlights()
    await act(async () => {
      await result.current.apply(YELLOW, [1, 3])
    })

    expect(getPendingOps(userId)).toEqual([expect.objectContaining({ verses: [1] })])
    // Verse 3 was rejected permanently, so its paint is gone.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.1': YELLOW })
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

  // AC 4 — the ownership token, end to end.
  it('a failed older write does not wipe the color a newer write painted', async () => {
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

    // The user re-taps verse 16 in green before yellow's POST comes back.
    let greenOutcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      greenOutcome = result.current.apply(GREEN, [16])
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })

    await act(async () => {
      slowYellow.resolve(transient(500))
      await yellowOutcome
      await greenOutcome
    })

    // Yellow failed, but it no longer owned verse 16 — green survives.
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

  it('keeps the verse cleared and queues the delete when the network fails', async () => {
    seedServer([highlight('JHN.3.16', YELLOW)])
    mockDeleteHighlight.mockResolvedValue(transient(500))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.remove(YELLOW, [16])
    })

    expect(outcome).toMatchObject({ status: 'error', failedVerses: [16] })
    expect(result.current.highlights).toEqual([])
    expect(getPendingOps(userId)).toEqual([
      expect.objectContaining({ op: 'remove', color: YELLOW, verses: [16] }),
    ])
  })

  it('restores the highlight when the delete is rejected permanently', async () => {
    seedServer([highlight('JHN.3.16', YELLOW)])
    mockDeleteHighlight.mockResolvedValue(transient(400, 'bad passage'))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.remove(YELLOW, [16])
    })

    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
    expect(getPendingOps(userId)).toEqual([])
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
  it('sees a claim made earlier in the same tick, before any re-render', async () => {
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

    expect(await removed).toEqual({ status: 'ok', verses: [16] })
    expect(mockDeleteHighlight).toHaveBeenCalledWith('token-1', 'JHN.3.16', { version_id: 111 })
    expect(result.current.highlights).toEqual([])
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

  it('rejects a non-swatch color from remove with no request', async () => {
    seedServer([highlight('JHN.3.16', 'ff0000')])
    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.remove('ff0000', [16])
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
    mockCreateHighlight.mockResolvedValue(transient(503, 'write died'))

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

// ── The durable write queue ──────────────────────────────────────────────────

describe('the write queue', () => {
  /** Puts a due op on disk exactly as a previous session would have left it. */
  function seedQueue(
    op: Partial<{
      id: string
      op: 'apply' | 'remove'
      color: string
      verses: number[]
      scope: HighlightScope
    }> = {},
  ) {
    const now = Date.now()
    mockMmkv.set(
      highlightQueueKey(userId),
      JSON.stringify({
        userId,
        ops: [
          {
            id: op.id ?? 'op-1',
            generation: 0,
            op: op.op ?? 'apply',
            scope: op.scope ?? scope,
            color: op.color ?? YELLOW,
            verses: op.verses ?? [16],
            attempts: 1,
            // Already due, so the mount replay picks it up without a timer.
            nextAttemptAt: now - 1,
            createdAt: now - QUEUE_INITIAL_BACKOFF_MS,
          },
        ],
      }),
    )
  }

  it('paints a queued write on the first frame after a relaunch', async () => {
    seedQueue()

    const { result } = renderUseHighlights()

    // Cache holds server truth only, so without the queue's overlay the user
    // would watch their own highlight vanish and come back.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })

    await act(async () => {
      await Promise.resolve()
    })
  })

  it('replays a queued write on mount and clears it once it lands', async () => {
    seedQueue()

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockCreateHighlight).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.3.16',
      color: YELLOW,
    })
    expect(getPendingOps(userId)).toEqual([])
    expect(result.current.hasPendingOperations).toBe(false)
  })

  it('backs the op off instead of dropping it when the retry fails again', async () => {
    seedQueue()
    mockCreateHighlight.mockResolvedValue(transient(500))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    expect(getPendingOps(userId)).toEqual([expect.objectContaining({ attempts: 2 })])
    // Still painted — the whole point of persisting it.
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
  })

  it('drops a queued op the server rejects permanently, and reverts its paint', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    seedQueue()
    mockCreateHighlight.mockResolvedValue(transient(422, 'uuid_parsing'))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    expect(getPendingOps(userId)).toEqual([])
    expect(result.current.highlights).toEqual([])
    // Nobody is awaiting a retry, so the log is the only report it can make.
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('hands an auth failure back to the permission prompt by invalidating the grant', async () => {
    saveGrantedPermissions(userId, ['highlights', 'votd'])
    seedQueue()
    mockCreateHighlight.mockResolvedValue(authError(403))

    renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    expect(getGrantedPermissions(userId)).toEqual(['votd'])
    expect(getPendingOps(userId)).toEqual([])
  })

  it('does not replay another user’s queue', async () => {
    seedQueue()

    renderUseHighlights({
      isAuthenticated: true,
      accessToken: 'token-2',
      userInfo: { id: 'user-2' },
      isLoading: false,
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockCreateHighlight).not.toHaveBeenCalled()
    // user-1's work is untouched, not stolen and not wiped.
    expect(getPendingOps(userId)).toHaveLength(1)
  })

  it('holds a queued op while signed out and runs it when a token arrives', async () => {
    seedQueue()

    const { rerender } = renderUseHighlights(signedOut)
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockCreateHighlight).not.toHaveBeenCalled()

    setAuth(rerender, signedIn)
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockCreateHighlight).toHaveBeenCalledTimes(1)
  })

  it('drops a queued result whose generation the session left behind', async () => {
    const held = deferred<Result<Highlight, HighlightsApiError>>()
    mockCreateHighlight.mockReturnValueOnce(held.promise)
    seedQueue()

    renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockCreateHighlight).toHaveBeenCalledTimes(1)

    // Sign-out discards the queue and bumps the generation while the request is
    // still on the wire.
    act(() => {
      clearHighlightQueue()
    })

    await act(async () => {
      held.resolve(transient(500))
      await held.promise
    })

    // The departed session's failure must not re-queue onto the next account.
    expect(getPendingOps(userId)).toEqual([])
  })

  it('supersedes a queued op when the user re-taps the same verse', async () => {
    seedQueue()
    mockCreateHighlight.mockResolvedValue(transient(500))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })
    expect(getPendingOps(userId)).toHaveLength(1)

    mockCreateHighlight.mockResolvedValue({ ok: true, value: highlight('JHN.3.16', GREEN) })
    await act(async () => {
      await result.current.apply(GREEN, [16])
    })

    // The yellow retry is gone: letting it run would land yellow on the server
    // after green, so the reader and the account would disagree.
    expect(getPendingOps(userId)).toEqual([])
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
  })

  it('reports pending work while a write is on the wire, before anything is queued', async () => {
    const held = deferred<Result<Highlight, HighlightsApiError>>()
    mockCreateHighlight.mockReturnValueOnce(held.promise)

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.hasPendingOperations).toBe(false)

    let outcome: Promise<HighlightWriteOutcome> | undefined
    await act(async () => {
      outcome = result.current.apply(YELLOW, [16])
      await Promise.resolve()
    })

    // Swift's #180 window: nothing is queued yet, but signing out here would
    // still lose the write.
    expect(result.current.hasPendingOperations).toBe(true)

    await act(async () => {
      held.resolve({ ok: true, value: highlight('JHN.3.16', YELLOW) })
      await outcome
    })

    expect(result.current.hasPendingOperations).toBe(false)
  })

  it('drops unconfirmed paint when the queue is discarded', async () => {
    seedQueue()
    mockCreateHighlight.mockResolvedValue(transient(500))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })

    await act(async () => {
      clearHighlightQueue()
    })

    // "Sign out anyway" must make the unsaved highlight disappear immediately,
    // not linger until something else re-renders.
    expect(result.current.highlights).toEqual([])
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

// ── The device sequence ──────────────────────────────────────────────────────
// Phase 6's queue suite only ever seeded ONE op and only ever drained it in one
// shot, so the paths a real offline session takes — several ops backing off
// behind each other, a new write arriving while the queue is already backed up,
// and the whole backlog draining when the network returns — went untested.

describe('a real offline session', () => {
  /** Several due ops on disk, exactly as consecutive offline writes leave them. */
  function seedQueuedVerses(verses: number[]) {
    const now = Date.now()
    mockMmkv.set(
      highlightQueueKey(userId),
      JSON.stringify({
        userId,
        ops: verses.map((verse, index) => ({
          id: `op-${verse}`,
          generation: 0,
          op: 'apply',
          scope,
          color: YELLOW,
          verses: [verse],
          attempts: 1,
          nextAttemptAt: now - 1_000 + index,
          createdAt: now - QUEUE_INITIAL_BACKOFF_MS,
        })),
      }),
    )
  }

  it('drains a whole backlog on relaunch, not just the head', async () => {
    seedQueuedVerses([7, 9, 11])

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockCreateHighlight.mock.calls.map((call) => call[1].passage_id)).toEqual([
      'JHN.3.7',
      'JHN.3.9',
      'JHN.3.11',
    ])
    expect(getPendingOps(userId)).toEqual([])
    expect(result.current.hasPendingOperations).toBe(false)
  })

  it('does not strand the tail when the head is still backing off', async () => {
    seedQueuedVerses([7, 9])
    mockCreateHighlight.mockResolvedValue(transient(500))

    renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    // Strict head-of-line: the tail waits, but it must still be ON the queue and
    // reported as pending rather than quietly dropped.
    const pending = getPendingOps(userId)
    expect(pending.map((op) => op.id)).toEqual(['op-7', 'op-9'])
    expect(pending[0]?.attempts).toBe(2)
    expect(pending[1]?.attempts).toBe(1)
  })

  it('queues a new write that arrives while the queue is already backed up', async () => {
    seedQueuedVerses([11])
    mockCreateHighlight.mockResolvedValue(transient(500))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.apply(YELLOW, [10])
    })

    expect(
      getPendingOps(userId)
        .flatMap((op) => op.verses)
        .sort((a, b) => a - b),
    ).toEqual([10, 11])
    expect(result.current.hasPendingOperations).toBe(true)
    // Painted, and staying painted — that is what the queue is buying.
    expect(colorsOf(result.current)['JHN.3.10']).toBe(YELLOW)
  })

  it('lands every queued write once the network comes back', async () => {
    jest.useFakeTimers()
    mockCreateHighlight.mockResolvedValue(transient(500))

    const { result } = renderUseHighlights()

    for (const verse of [7, 9, 11]) {
      await act(async () => {
        await result.current.apply(YELLOW, [verse])
      })
    }
    expect(getPendingOps(userId).flatMap((op) => op.verses)).toEqual([7, 9, 11])

    mockCreateHighlight.mockResolvedValue({ ok: true, value: highlight('JHN.3.7', YELLOW) })

    // Each pass covers one backoff window; the cap is 30s.
    for (let pass = 0; pass < 6; pass += 1) {
      await act(async () => {
        jest.advanceTimersByTime(QUEUE_MAX_BACKOFF_MS + 1_000)
        await Promise.resolve()
      })
    }

    expect(getPendingOps(userId)).toEqual([])
    expect(result.current.hasPendingOperations).toBe(false)
    jest.useRealTimers()
  })

  it('keeps reporting pending work for the whole backlog, so the sign-out guard cannot go blind', async () => {
    seedQueuedVerses([7, 9, 11])
    mockCreateHighlight.mockResolvedValue(transient(500))

    const { result } = renderUseHighlights()
    await act(async () => {
      await Promise.resolve()
    })

    expect(getPendingOps(userId)).toHaveLength(3)
    expect(result.current.hasPendingOperations).toBe(true)
  })
})
