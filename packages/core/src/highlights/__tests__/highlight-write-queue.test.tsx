import type { Collection, Highlight } from '@youversion/platform-core'
import { act, renderHook } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { AuthContext, type AccessTokenResult, type AuthContextValue } from '../../auth/auth-context'
import type { Result } from '../../result'
import { YouVersionContext } from '../../youversion-context'
import type { HighlightsApiError } from '../api'
import { isWriteClaimed } from '../claims'
import { startHighlightQueueDrain } from '../drain'
import { onDrainSignal, type DrainSignal } from '../drain-signals'
import {
  highlightQueueKey,
  highlightsCacheKey,
  MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX,
  type HighlightScope,
  type QueuedWrites,
} from '../constants'
import {
  useHighlights,
  type HighlightWriteOutcome,
  type UseHighlightsResult,
} from '../use-highlights'

// ── Boundaries ───────────────────────────────────────────────────────────────
// Only the two real external edges are faked: MMKV and the API client. The
// queue, its projection, the optimistic layer and the cache all run for real.

const mockMmkv = new Map<string, string>()

/** Set to a key prefix to make `mmkvStorage.set` throw for it, as a full store does. */
let mockFailingSetPrefix: string | null = null

jest.mock('../../storage/mmkv-storage', () => ({
  mmkvStorage: {
    set: jest.fn((k: string, v: string) => {
      if (mockFailingSetPrefix !== null && k.startsWith(mockFailingSetPrefix)) {
        throw new Error('MMKV is out of space')
      }
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

/** No response at all — airplane mode, dead wifi, a timeout. Queue-eligible. */
const unreachable = () => apiError({ kind: 'transient', message: 'Network request failed' })

/** The server answered and said no. Reverts rather than parking. */
const rejected = () => apiError({ kind: 'transient', status: 422, message: 'no' })

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const ensureFreshToken = jest.fn(async () => undefined)

/** Hoisted rather than built per render, so a test can drive a failed refresh. */
const getAccessToken = jest.fn<Promise<AccessTokenResult>, []>()

/**
 * Swapped per test so a case can render against a different auth state without
 * remounting. `userInfo` stays seeded in every shape: it comes from its own
 * synchronous initializer in `AuthProvider`, so the id is there before the token.
 */
let authOverrides: Partial<AuthContextValue> = {}

/** Signed in, `userInfo` already read from cache, `loadTokens()` not yet resolved. */
const tokenLoading: Partial<AuthContextValue> = {
  isAuthenticated: false,
  accessToken: null,
  isLoading: true,
}

function authValue(): AuthContextValue {
  return {
    isAuthenticated: true,
    accessToken: 'token-1',
    userInfo: { id: userId },
    error: null,
    signIn: jest.fn(async () => undefined),
    signOut: jest.fn(async () => undefined),
    refreshNow: jest.fn(async () => undefined),
    ensureFreshToken,
    getAccessToken,
    isLoading: false,
    requestedPermissions: ['highlights'],
    grantedPermissions: null,
    hasPermission: jest.fn(() => false),
    invalidatePermissions: jest.fn(),
    requestPermissions: jest.fn(),
    ...authOverrides,
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

function renderUseHighlights(initialProps = options) {
  return renderHook((props: typeof options) => useHighlights(props), {
    wrapper: Wrapper,
    initialProps,
  })
}

function seedServer(highlights: Highlight[]) {
  mockMmkv.set(highlightsCacheKey(userId, scope), JSON.stringify(highlights))
  mockGetHighlights.mockResolvedValue(collection(highlights))
}

function colorsOf(result: UseHighlightsResult): Record<string, string> {
  return Object.fromEntries(result.highlights.map((h) => [h.passage_id, h.color]))
}

function queuedWrites(): QueuedWrites | null {
  const raw = mockMmkv.get(highlightQueueKey(userId, scope))
  return raw === undefined ? null : (JSON.parse(raw) as QueuedWrites)
}

function readCache(forScope = scope): Highlight[] | null {
  const raw = mockMmkv.get(highlightsCacheKey(userId, forScope))
  return raw === undefined ? null : (JSON.parse(raw) as Highlight[])
}

/** Let the mount fetch (and anything else already queued) settle. */
async function flush() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  mockMmkv.clear()
  mockFailingSetPrefix = null
  authOverrides = {}
  jest.clearAllMocks()
  mockGetHighlights.mockReset()
  mockCreateHighlight.mockReset()
  mockDeleteHighlight.mockReset()
  ensureFreshToken.mockReset()
  ensureFreshToken.mockResolvedValue(undefined)
  getAccessToken.mockReset()
  getAccessToken.mockResolvedValue({ status: 'ok', token: 'token-1', userId })
  mockGetHighlights.mockResolvedValue(collection([]))
  mockCreateHighlight.mockResolvedValue({ ok: true, value: highlight('JHN.3.16', YELLOW) })
  mockDeleteHighlight.mockResolvedValue({ ok: true, value: undefined })
})

describe('a write that cannot reach the server', () => {
  it('keeps the paint and reports queued', async () => {
    mockCreateHighlight.mockResolvedValue(unreachable())

    const { result } = renderUseHighlights()
    await flush()

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    expect(outcome).toEqual({ status: 'queued', verses: [16] })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
    expect(queuedWrites()).toEqual({ 16: { local: YELLOW, server: null } })
  })

  it('keeps a removal hidden and reports queued', async () => {
    seedServer([highlight('JHN.3.16', YELLOW)])
    mockDeleteHighlight.mockResolvedValue(unreachable())

    const { result } = renderUseHighlights()
    await flush()

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.remove(YELLOW, [16])
    })

    expect(outcome).toEqual({ status: 'queued', verses: [16] })
    expect(colorsOf(result.current)).toEqual({})
    expect(queuedWrites()).toEqual({ 16: { local: null, server: YELLOW } })
  })

  it('does not spend a GET when nothing reached the server', async () => {
    mockCreateHighlight.mockResolvedValue(unreachable())

    const { result } = renderUseHighlights()
    await flush()
    mockGetHighlights.mockClear()

    await act(async () => {
      await result.current.apply(YELLOW, [16])
    })

    expect(mockGetHighlights).not.toHaveBeenCalled()
  })

  it('leaves nothing queued once the write lands', async () => {
    const { result } = renderUseHighlights()
    await flush()

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    expect(outcome).toEqual({ status: 'ok', verses: [16] })
    expect(queuedWrites()).toBeNull()
  })
})

describe('a write stopped by a failed token refresh', () => {
  beforeEach(() => {
    getAccessToken.mockResolvedValue({ status: 'unavailable', reason: 'refresh-failed' })
  })

  it('takes the paint back and parks nothing', async () => {
    seedServer([highlight('JHN.3.16', GREEN)])

    const { result } = renderUseHighlights()
    await flush()

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    // `transient`, not `queued`: the paint is gone, so the caller must not be
    // told the highlight is saved offline.
    expect(outcome).toMatchObject({ status: 'error', reason: 'transient', failedVerses: [16] })
    expect(mockCreateHighlight).not.toHaveBeenCalled()
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
    expect(queuedWrites()).toBeNull()
  })

  it('puts a removal back on screen and parks nothing', async () => {
    seedServer([highlight('JHN.3.16', YELLOW)])

    const { result } = renderUseHighlights()
    await flush()

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.remove(YELLOW, [16])
    })

    expect(outcome).toMatchObject({ status: 'error', reason: 'transient', failedVerses: [16] })
    expect(mockDeleteHighlight).not.toHaveBeenCalled()
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
    expect(queuedWrites()).toBeNull()
  })

  it('leaves the next launch nothing owed', async () => {
    seedServer([highlight('JHN.3.16', GREEN)])

    const first = renderUseHighlights()
    await flush()
    await act(async () => {
      await first.result.current.apply(YELLOW, [16])
    })
    first.unmount()

    mockGetHighlights.mockResolvedValue(unreachable())
    const second = renderUseHighlights()

    expect(colorsOf(second.result.current)).toEqual({ 'JHN.3.16': GREEN })
    expect(queuedWrites()).toBeNull()
  })
})

describe('a queued write after a relaunch', () => {
  it('is painted again before anything touches the network', async () => {
    mockCreateHighlight.mockResolvedValue(unreachable())

    const first = renderUseHighlights()
    await flush()
    await act(async () => {
      await first.result.current.apply(YELLOW, [16])
    })
    first.unmount()

    // Cold start, still no service.
    mockGetHighlights.mockResolvedValue(unreachable())
    const second = renderUseHighlights()

    expect(colorsOf(second.result.current)).toEqual({ 'JHN.3.16': YELLOW })
    expect(queuedWrites()).toEqual({ 16: { local: YELLOW, server: null } })
  })

  // MMKV is written queue first, cache second. A process that died between the
  // two comes back owing a write it does not show, and the mount repairs it.
  it('is painted again even if the cache never recorded it', async () => {
    mockCreateHighlight.mockResolvedValue(unreachable())

    const first = renderUseHighlights()
    await flush()
    await act(async () => {
      await first.result.current.apply(YELLOW, [16])
    })
    first.unmount()
    mockMmkv.delete(highlightsCacheKey(userId, scope))

    mockGetHighlights.mockResolvedValue(unreachable())
    const second = renderUseHighlights()

    expect(colorsOf(second.result.current)).toEqual({ 'JHN.3.16': YELLOW })
  })
})

describe('an unreadable queue', () => {
  it.each([
    ['not JSON', 'not json at all'],
    ['the wrong shape', '{"16":"fffe00"}'],
    ['an unusable verse number', '{"0":{"local":"fffe00","server":null}}'],
  ])('falls back to the cache rather than throwing when it holds %s', async (_label, raw) => {
    seedServer([highlight('JHN.3.16', GREEN)])
    mockMmkv.set(highlightQueueKey(userId, scope), raw)
    mockGetHighlights.mockResolvedValue(unreachable())

    const { result } = renderUseHighlights()

    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
  })
})

describe('the queue holds desired state, not a log of operations', () => {
  it('overwrites the entry when the same verse is written again', async () => {
    mockCreateHighlight.mockResolvedValue(unreachable())

    const { result } = renderUseHighlights()
    await flush()

    await act(async () => {
      await result.current.apply(YELLOW, [16])
    })
    await act(async () => {
      await result.current.apply(GREEN, [16])
    })

    expect(queuedWrites()).toEqual({ 16: { local: GREEN, server: null } })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
  })

  it('drops the entry when the user undoes the write offline', async () => {
    mockCreateHighlight.mockResolvedValue(unreachable())
    mockDeleteHighlight.mockResolvedValue(unreachable())

    const { result } = renderUseHighlights()
    await flush()

    await act(async () => {
      await result.current.apply(YELLOW, [16])
    })
    await act(async () => {
      await result.current.remove(YELLOW, [16])
    })

    expect(queuedWrites()).toBeNull()
    expect(colorsOf(result.current)).toEqual({})
    expect(mockDeleteHighlight).not.toHaveBeenCalled()
  })

  // A verse holds one color at a time, so the color the user replaced is not a
  // state the server ever needs to see.
  it('sends only the newest color when a tap supersedes one still in flight', async () => {
    const slowYellow = deferred<Result<Highlight, HighlightsApiError>>()
    mockCreateHighlight.mockReturnValueOnce(slowYellow.promise)

    const { result } = renderUseHighlights()
    await flush()

    let yellow: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      yellow = result.current.apply(YELLOW, [16])
    })
    act(() => {
      void result.current.apply(GREEN, [16])
    })

    await act(async () => {
      slowYellow.resolve({ ok: true, value: highlight('JHN.3.16', YELLOW) })
      await yellow
    })

    expect(await yellow).toEqual({ status: 'noop' })
    expect(mockCreateHighlight).toHaveBeenCalledTimes(1)
    expect(mockCreateHighlight).toHaveBeenCalledWith('token-1', {
      version_id: 111,
      passage_id: 'JHN.3.16',
      color: GREEN,
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
  })

  // The entry's server state is captured once, by the first write to that verse,
  // so a rejection puts the verse back where the server had it — not where an
  // intervening local write left it.
  it('reverts to what the server had, not to the write it replaced', async () => {
    seedServer([highlight('JHN.3.16', GREEN)])
    mockCreateHighlight.mockResolvedValueOnce(unreachable())

    const { result } = renderUseHighlights()
    await flush()

    await act(async () => {
      await result.current.apply(YELLOW, [16])
    })

    mockCreateHighlight.mockResolvedValue(rejected())
    await act(async () => {
      await result.current.apply(BLUE, [16])
    })

    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
    expect(queuedWrites()).toBeNull()
  })
})

describe('a write still held in the token-loading window when the reader unmounts', () => {
  it('parks it, keeps the entry, and releases the claim', async () => {
    authOverrides = tokenLoading
    const signals: DrainSignal[] = []
    const unsubscribe = onDrainSignal((signal) => signals.push(signal))

    const { result, unmount } = renderUseHighlights()

    let outcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      outcome = result.current.apply(YELLOW, [16])
    })

    // Painted and persisted, but held: no request has gone out.
    expect(queuedWrites()).toEqual({ 16: { local: YELLOW, server: null } })
    expect(mockCreateHighlight).not.toHaveBeenCalled()

    unmount()
    await act(async () => {
      await outcome
    })

    expect(await outcome).toEqual({ status: 'queued', verses: [16] })
    // The entry stands. Resuming against the still-null token would classify
    // `not-signed-in` and revert, deleting a write the server never saw.
    expect(queuedWrites()).toEqual({ 16: { local: YELLOW, server: null } })
    // And the claim is released, so the drain can send it in this same session
    // rather than skipping the verse until relaunch.
    expect(isWriteClaimed(userId, scope, 16)).toBe(false)
    expect(signals).toContain('write-parked')

    unsubscribe()
  })

  it('parks a held removal the same way', async () => {
    seedServer([highlight('JHN.3.16', YELLOW)])
    authOverrides = tokenLoading

    const { result, unmount } = renderUseHighlights()

    let outcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      outcome = result.current.remove(YELLOW, [16])
    })

    unmount()
    await act(async () => {
      await outcome
    })

    expect(await outcome).toEqual({ status: 'queued', verses: [16] })
    expect(queuedWrites()).toEqual({ 16: { local: null, server: YELLOW } })
    expect(isWriteClaimed(userId, scope, 16)).toBe(false)
    expect(mockDeleteHighlight).not.toHaveBeenCalled()
  })
})

describe('a store that refuses the queue entry', () => {
  it('reports transient before anything paints, claims, or is sent', async () => {
    const { result } = renderUseHighlights()
    await flush()
    mockFailingSetPrefix = MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    // Resolves an outcome — `apply` never rejects, whatever storage does.
    expect(outcome).toMatchObject({
      status: 'error',
      reason: 'transient',
      failedVerses: [16],
      succeededVerses: [],
    })
    expect(colorsOf(result.current)).toEqual({})
    expect(queuedWrites()).toBeNull()
    expect(isWriteClaimed(userId, scope, 16)).toBe(false)
    expect(mockCreateHighlight).not.toHaveBeenCalled()
  })
})

describe('a refusal that settles after the reader has changed chapter', () => {
  const JHN4 = { versionId: 111, book: 'JHN', chapter: '4' }
  const refused = () => apiError({ kind: 'auth', status: 403, message: 'no' })

  it('reverts the cache of the chapter the write was made in', async () => {
    seedServer([highlight('JHN.3.16', GREEN)])
    const held = deferred<Result<Highlight, HighlightsApiError>>()
    mockCreateHighlight.mockReturnValueOnce(held.promise)

    const { result, rerender } = renderUseHighlights()
    await flush()

    let outcome: Promise<HighlightWriteOutcome> | undefined
    act(() => {
      outcome = result.current.apply(YELLOW, [16])
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(mockCreateHighlight).toHaveBeenCalledTimes(1)
    expect(readCache()).toEqual([highlight('JHN.3.16', YELLOW)])

    // The reader moves on while the write is on the wire, so the un-paint has no
    // mounted state to land in — only the cache can carry it.
    act(() => {
      rerender(JHN4)
    })

    await act(async () => {
      held.resolve(refused())
      await outcome
    })

    expect(await outcome).toMatchObject({ status: 'error', reason: 'auth', failedVerses: [16] })
    expect(readCache()).toEqual([highlight('JHN.3.16', GREEN)])
    expect(queuedWrites()).toBeNull()
  })

  it('still un-paints and matches the cache when the refusal lands in scope', async () => {
    seedServer([highlight('JHN.3.16', GREEN)])
    mockCreateHighlight.mockResolvedValue(refused())

    const { result } = renderUseHighlights()
    await flush()

    let outcome: HighlightWriteOutcome | undefined
    await act(async () => {
      outcome = await result.current.apply(YELLOW, [16])
    })

    expect(outcome).toMatchObject({ status: 'error', reason: 'auth', failedVerses: [16] })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
    expect(readCache()).toEqual([highlight('JHN.3.16', GREEN)])
    expect(queuedWrites()).toBeNull()
  })
})

describe('a parked write the drain drops', () => {
  const JHN4: HighlightScope = { versionId: 111, book: 'JHN', chapter: '4' }

  const refused = () => apiError({ kind: 'auth', status: 401, message: 'no' })

  function queuedWritesFor(target: HighlightScope): QueuedWrites | null {
    const raw = mockMmkv.get(highlightQueueKey(userId, target))
    return raw === undefined ? null : (JSON.parse(raw) as QueuedWrites)
  }

  /** One full drain pass against the same fake MMKV the mounted hooks read. */
  async function drainOnce() {
    const drain = startHighlightQueueDrain({
      api: {
        getHighlights: mockGetHighlights,
        createHighlight: mockCreateHighlight,
        deleteHighlight: mockDeleteHighlight,
      },
      getAuth: () => ({
        userId,
        accessToken: 'token-1',
        ensureFreshToken: null,
        refreshNow: async () => undefined,
      }),
    })
    await act(async () => {
      drain.drainNow()
      for (let tick = 0; tick < 12; tick++) {
        await Promise.resolve()
      }
    })
    drain.stop()
  }

  it('un-paints on the reader still mounted, with no remount', async () => {
    seedServer([highlight('JHN.3.16', GREEN)])
    mockCreateHighlight.mockResolvedValue(unreachable())

    const { result } = renderUseHighlights()
    await flush()

    await act(async () => {
      await result.current.apply(YELLOW, [16])
    })
    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })

    // The service returns and states twice that it will not take this write.
    mockCreateHighlight.mockResolvedValue(refused())
    await drainOnce()

    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': GREEN })
    expect(queuedWrites()).toBeNull()
  })

  it('leaves the paint alone when the refusal heals on the forced refresh', async () => {
    mockCreateHighlight.mockResolvedValue(unreachable())

    const { result } = renderUseHighlights()
    await flush()

    await act(async () => {
      await result.current.apply(YELLOW, [16])
    })

    mockCreateHighlight
      .mockResolvedValueOnce(refused())
      .mockResolvedValue({ ok: true, value: highlight('JHN.3.16', YELLOW) })
    await drainOnce()

    expect(colorsOf(result.current)).toEqual({ 'JHN.3.16': YELLOW })
    expect(queuedWrites()).toBeNull()
  })

  it('leaves a reader on another chapter painted and still owed its write', async () => {
    mockCreateHighlight.mockResolvedValue(unreachable())

    const { result } = renderUseHighlights()
    const other = renderHook(() => useHighlights(JHN4), { wrapper: Wrapper })
    await flush()

    await act(async () => {
      await result.current.apply(YELLOW, [16])
      await other.result.current.apply(GREEN, [1])
    })
    expect(colorsOf(other.result.current)).toEqual({ 'JHN.4.1': GREEN })

    // Only JHN 3's write is refused; JHN 4's still cannot reach the server.
    mockCreateHighlight.mockImplementation(async (_token, data) =>
      data.color === YELLOW ? refused() : unreachable(),
    )
    await drainOnce()

    expect(colorsOf(result.current)).toEqual({})
    expect(queuedWrites()).toBeNull()
    expect(colorsOf(other.result.current)).toEqual({ 'JHN.4.1': GREEN })
    expect(queuedWritesFor(JHN4)).toEqual({ 1: { local: GREEN, server: null } })
  })
})
