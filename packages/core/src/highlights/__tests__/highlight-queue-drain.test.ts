/**
 * Vertical seam for the Highlight Write Queue drain: real queue, real cache,
 * real paint projection. Only MMKV and the API client are faked.
 *
 * No test pins a backoff interval. The growth test measures the gaps the drain
 * actually waits and asserts the shape of the sequence, so retuning the
 * constants cannot red this file.
 */

import { claimWrites } from '../claims'
import { getCachedHighlights, setCachedHighlights } from '../cache'
import { startHighlightQueueDrain, type DrainAuth } from '../drain'
import { enqueueWrites, getQueuedWrites } from '../queue'
import { err, ok } from '../../result'
import type { HighlightsApi, HighlightsApiError } from '../api'
import type { HighlightScope } from '../constants'

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

const USER = 'user-1'
const JHN3: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }
const JHN4: HighlightScope = { versionId: 111, book: 'JHN', chapter: '4' }
const YELLOW = 'ffd43b'
const GREEN = '51cf66'

/** Never reached the server. */
const UNREACHABLE: HighlightsApiError = { kind: 'transient', message: 'offline' }
/** Reached it and was refused. */
const REFUSED: HighlightsApiError = { kind: 'auth', status: 401, message: 'no' }

type Call = { kind: 'create' | 'delete'; passageId: string; color?: string }

type CreateResult = Awaited<ReturnType<HighlightsApi['createHighlight']>>

/** `onCreate` chooses the POST's answer per call; the attempt is recorded either way. */
function createApi({
  onCreate,
  ...overrides
}: Partial<HighlightsApi> & {
  onCreate?: () => CreateResult | Promise<CreateResult>
} = {}) {
  const calls: Call[] = []
  const api: HighlightsApi = {
    getHighlights: jest.fn(async () => ok({ data: [] }) as never),
    createHighlight: jest.fn(async (_token, data) => {
      calls.push({ kind: 'create', passageId: data.passage_id, color: data.color })
      return onCreate ? await onCreate() : (ok({} as never) as CreateResult)
    }),
    deleteHighlight: jest.fn(async (_token, passageId) => {
      calls.push({ kind: 'delete', passageId })
      return ok(undefined)
    }),
    ...overrides,
  }
  return { api, calls }
}

function signedIn(overrides: Partial<DrainAuth> = {}): () => DrainAuth {
  const auth: DrainAuth = {
    userId: USER,
    accessToken: 'token-1',
    ensureFreshToken: null,
    ...overrides,
  }
  return () => auth
}

function queueApply(scope: HighlightScope, verses: number[], color: string | null) {
  enqueueWrites({ userId: USER, scope, verses, color, currentColors: {} })
}

/** Runs everything the drain does synchronously-ish, without waiting on timers. */
async function settle() {
  for (let tick = 0; tick < 12; tick++) {
    await Promise.resolve()
  }
}

beforeEach(() => {
  mockMmkv.clear()
  jest.clearAllMocks()
})

describe('startHighlightQueueDrain', () => {
  it('sends a queued write and clears its entry when the service returns', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([{ kind: 'create', passageId: 'JHN.3.16', color: YELLOW }])
    expect(getQueuedWrites(USER, JHN3)).toEqual({})
  })

  it('writes the landed color into the cache, which is what the next mount paints', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(getCachedHighlights(USER, JHN3)).toEqual([
      { version_id: 111, passage_id: 'JHN.3.16', color: YELLOW },
    ])
  })

  it('leaves highlights the write did not touch alone in the cache', async () => {
    setCachedHighlights(USER, JHN3, [{ version_id: 111, passage_id: 'JHN.3.1', color: GREEN }])
    queueApply(JHN3, [16], YELLOW)
    const { api } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(getCachedHighlights(USER, JHN3)).toEqual([
      { version_id: 111, passage_id: 'JHN.3.1', color: GREEN },
      { version_id: 111, passage_id: 'JHN.3.16', color: YELLOW },
    ])
  })

  it('lands a removal, taking the verse out of the cache', async () => {
    setCachedHighlights(USER, JHN3, [{ version_id: 111, passage_id: 'JHN.3.16', color: YELLOW }])
    enqueueWrites({
      userId: USER,
      scope: JHN3,
      verses: [16],
      color: null,
      currentColors: { 16: YELLOW },
    })
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([{ kind: 'delete', passageId: 'JHN.3.16' }])
    expect(getCachedHighlights(USER, JHN3)).toEqual([])
  })

  it('drains a chapter no reader is mounted on', async () => {
    queueApply(JHN3, [16], YELLOW)
    queueApply(JHN4, [1], GREEN)
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls.map((call) => call.passageId).sort()).toEqual(['JHN.3.16', 'JHN.4.1'])
    expect(getQueuedWrites(USER, JHN3)).toEqual({})
    expect(getQueuedWrites(USER, JHN4)).toEqual({})
  })

  it('collapses an applied run into one ranged request', async () => {
    queueApply(JHN3, [16, 17, 18], YELLOW)
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([{ kind: 'create', passageId: 'JHN.3.16-18', color: YELLOW }])
  })

  it('sends removals one verse at a time, because a DELETE carries no color', async () => {
    enqueueWrites({
      userId: USER,
      scope: JHN3,
      verses: [16, 17],
      color: null,
      currentColors: { 16: YELLOW, 17: YELLOW },
    })
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([
      { kind: 'delete', passageId: 'JHN.3.16' },
      { kind: 'delete', passageId: 'JHN.3.17' },
    ])
  })

  it('groups a mixed queue by the color each verse is owed', async () => {
    queueApply(JHN3, [16], YELLOW)
    queueApply(JHN3, [17], GREEN)
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toHaveLength(2)
    expect(calls).toContainEqual({ kind: 'create', passageId: 'JHN.3.16', color: YELLOW })
    expect(calls).toContainEqual({ kind: 'create', passageId: 'JHN.3.17', color: GREEN })
  })

  it('does not touch a verse a mounted hook has already claimed', async () => {
    queueApply(JHN3, [16], YELLOW)
    queueApply(JHN3, [17], YELLOW)
    const release = claimWrites(USER, JHN3, [16])
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()

    expect(calls).toEqual([{ kind: 'create', passageId: 'JHN.3.17', color: YELLOW }])
    expect(getQueuedWrites(USER, JHN3)).toEqual({ 16: { local: YELLOW, server: null } })

    release()
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toContainEqual({ kind: 'create', passageId: 'JHN.3.16', color: YELLOW })
    expect(getQueuedWrites(USER, JHN3)).toEqual({})
  })

  it('retires an entry the server already agrees with, without a request', async () => {
    // `local === server` — a reconcile caught up with it while it sat queued.
    mockMmkv.set(
      `yvp.highlightqueue.${USER}.111.JHN.3`,
      JSON.stringify({ 16: { local: YELLOW, server: YELLOW } }),
    )
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([])
    expect(getQueuedWrites(USER, JHN3)).toEqual({})
  })

  it('keeps the entry, and so the paint, when the write is refused', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api } = createApi({ onCreate: () => err(REFUSED) })

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(getQueuedWrites(USER, JHN3)).toEqual({ 16: { local: YELLOW, server: null } })
  })

  it('keeps the entry when the server is unreachable', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api } = createApi({ onCreate: () => err(UNREACHABLE) })

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(getQueuedWrites(USER, JHN3)).toEqual({ 16: { local: YELLOW, server: null } })
    expect(getCachedHighlights(USER, JHN3)).toBeNull()
  })

  it('sends the newest intent when a verse was re-tapped while parked', async () => {
    queueApply(JHN3, [16], YELLOW)
    queueApply(JHN3, [16], GREEN)
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([{ kind: 'create', passageId: 'JHN.3.16', color: GREEN }])
  })

  it('does nothing with no user', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({
      api,
      getAuth: signedIn({ userId: null }),
    })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([])
  })

  it('does nothing with no access token', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({
      api,
      getAuth: signedIn({ accessToken: null }),
    })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([])
  })

  it('refreshes the token once per pass before sending', async () => {
    queueApply(JHN3, [16], YELLOW)
    queueApply(JHN4, [1], YELLOW)
    const ensureFreshToken = jest.fn(async () => {})
    const { api } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn({ ensureFreshToken }) })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(ensureFreshToken).toHaveBeenCalledTimes(1)
  })

  it('stops mid-pass rather than sending one user’s passage under another’s token', async () => {
    queueApply(JHN3, [16], YELLOW)
    queueApply(JHN4, [1], YELLOW)
    const { api, calls } = createApi()

    let auth: DrainAuth = { userId: USER, accessToken: 'token-1', ensureFreshToken: null }
    const drain = startHighlightQueueDrain({ api, getAuth: () => auth })
    // Signs out during the refresh that precedes the first scope.
    auth = {
      userId: USER,
      accessToken: 'token-1',
      ensureFreshToken: async () => {
        auth = { userId: 'user-2', accessToken: 'token-2', ensureFreshToken: null }
      },
    }
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([])
  })

  it('abandons the remaining scopes when the user changes after the first one is sent', async () => {
    queueApply(JHN3, [16], YELLOW)
    queueApply(JHN4, [1], YELLOW)

    let auth: DrainAuth = { userId: USER, accessToken: 'token-1', ensureFreshToken: null }
    const { api, calls } = createApi({
      onCreate: () => {
        auth = { userId: 'user-2', accessToken: 'token-2', ensureFreshToken: null }
        return ok({} as never) as CreateResult
      },
    })

    const drain = startHighlightQueueDrain({ api, getAuth: () => auth })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([{ kind: 'create', passageId: 'JHN.3.16', color: YELLOW }])
    expect((api.createHighlight as jest.Mock).mock.calls.map(([token]) => token)).toEqual([
      'token-1',
    ])
    expect(getQueuedWrites(USER, JHN4)).toEqual({ 1: { local: YELLOW, server: null } })
    expect(getCachedHighlights('user-2', JHN3)).toBeNull()
    expect(getCachedHighlights('user-2', JHN4)).toBeNull()
  })

  it('survives a throwing token refresh', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api, calls } = createApi()
    const drain = startHighlightQueueDrain({
      api,
      getAuth: signedIn({
        ensureFreshToken: async () => {
          throw new Error('boom')
        },
      }),
    })

    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([])
    expect(getQueuedWrites(USER, JHN3)).toEqual({ 16: { local: YELLOW, server: null } })
  })

  it('coalesces overlapping triggers into a single pass', async () => {
    queueApply(JHN3, [16], YELLOW)
    let resolveCreate = (): void => {}
    const { api, calls } = createApi({
      onCreate: async () => {
        await new Promise<void>((resolve) => {
          resolveCreate = resolve
        })
        return ok({} as never) as CreateResult
      },
    })

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await Promise.resolve()
    drain.drainNow()
    drain.drainNow()
    resolveCreate()
    await settle()
    drain.stop()

    // The re-run happens, but finds nothing owed.
    expect(calls).toHaveLength(1)
  })

  it('sends nothing after stop()', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.stop()
    drain.drainNow()
    await settle()

    expect(calls).toEqual([])
  })
})

describe('drain retries', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  /** Advances until the next request goes out, and reports how long that took. */
  async function timeToNextAttempt(calls: Call[], step = 1000, maxSteps = 8000): Promise<number> {
    const before = calls.length
    for (let taken = 1; taken <= maxSteps; taken++) {
      await jest.advanceTimersByTimeAsync(step)
      if (calls.length > before) {
        return taken * step
      }
    }
    return Infinity
  }

  it('waits longer after each consecutive failure, at least doubling', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api, calls } = createApi({ onCreate: () => err(UNREACHABLE) })

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await jest.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(1)

    const gaps = [
      await timeToNextAttempt(calls),
      await timeToNextAttempt(calls),
      await timeToNextAttempt(calls),
    ]
    drain.stop()

    expect(gaps.every(Number.isFinite)).toBe(true)
    expect(gaps[1]).toBeGreaterThanOrEqual((gaps[0] ?? 0) * 2)
    expect(gaps[2]).toBeGreaterThanOrEqual((gaps[1] ?? 0) * 2)
  })

  it('lands the write on a retry once the service comes back', async () => {
    queueApply(JHN3, [16], YELLOW)
    let reachable = false
    const { api, calls } = createApi({
      onCreate: () => (reachable ? (ok({} as never) as CreateResult) : err(UNREACHABLE)),
    })

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await jest.advanceTimersByTimeAsync(0)
    expect(getQueuedWrites(USER, JHN3)).not.toEqual({})

    reachable = true
    await timeToNextAttempt(calls)
    drain.stop()

    expect(getQueuedWrites(USER, JHN3)).toEqual({})
    expect(getCachedHighlights(USER, JHN3)).toEqual([
      { version_id: 111, passage_id: 'JHN.3.16', color: YELLOW },
    ])
  })

  it('sends a backed-off entry immediately when a trigger fires', async () => {
    // The whole point of the connectivity edge: the wait was a guess about a
    // network nobody had asked, and the trigger is the answer arriving.
    queueApply(JHN3, [16], YELLOW)
    const { api, calls } = createApi({ onCreate: () => err(UNREACHABLE) })

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await jest.advanceTimersByTimeAsync(0)
    for (let failure = 0; failure < 4; failure++) {
      await timeToNextAttempt(calls)
    }
    const attempts = calls.length

    drain.drainNow()
    await jest.advanceTimersByTimeAsync(0)
    drain.stop()

    expect(calls).toHaveLength(attempts + 1)
  })

  it('keeps widening the wait after a trigger rather than starting the decay over', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api, calls } = createApi({ onCreate: () => err(UNREACHABLE) })

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await jest.advanceTimersByTimeAsync(0)
    const first = await timeToNextAttempt(calls)

    // A trigger buys an attempt, not a fresh start.
    drain.drainNow()
    await jest.advanceTimersByTimeAsync(0)
    const next = await timeToNextAttempt(calls)
    drain.stop()

    expect(next).toBeGreaterThanOrEqual((first ?? 0) * 2)
  })

  it('retries a parked write on noteParkedWrite() without re-sending it first', async () => {
    // The write path already tried and failed; the drain owes it a later attempt.
    queueApply(JHN3, [16], YELLOW)
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.noteParkedWrite()
    await jest.advanceTimersByTimeAsync(0)
    expect(calls).toEqual([])

    await timeToNextAttempt(calls)
    drain.stop()

    expect(calls).toEqual([{ kind: 'create', passageId: 'JHN.3.16', color: YELLOW }])
  })

  it('sends nothing more once the queue is empty', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api, calls } = createApi()

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await jest.advanceTimersByTimeAsync(0)
    expect(getQueuedWrites(USER, JHN3)).toEqual({})

    expect(await timeToNextAttempt(calls, 1000, 100)).toBe(Infinity)
    drain.stop()
  })

  it('cancels the retry clock on stop()', async () => {
    queueApply(JHN3, [16], YELLOW)
    const { api, calls } = createApi({ onCreate: () => err(UNREACHABLE) })

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn() })
    drain.drainNow()
    await jest.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(1)

    drain.stop()
    expect(await timeToNextAttempt(calls, 1000, 100)).toBe(Infinity)
  })
})
