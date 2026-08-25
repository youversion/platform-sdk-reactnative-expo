/**
 * Vertical seam for the Highlight Write Queue drain: real queue, real cache,
 * real paint projection. The API client is faked; MMKV is the in-memory shim.
 *
 * No test pins a backoff interval. The growth test measures the gaps the drain
 * actually waits and asserts the shape of the sequence, so retuning the
 * constants cannot red this file.
 */

import type { Highlight } from '@youversion/platform-core'

import { claimWrites } from '../claims'
import { getCachedHighlights, setCachedHighlights } from '../cache'
import { startHighlightQueueDrain, type DrainAuth } from '../drain'
import { enqueueWrites, getQueuedWrites } from '../queue'
import { err, ok } from '../../result'
import type { HighlightsApi, HighlightsApiError } from '../api'
import type { HighlightScope } from '../constants'
import { mmkvStorage } from '../../storage/mmkv-storage'

const EMPTY_CREATED: Highlight = { version_id: 0, passage_id: '', color: '' }

const USER = 'user-1'
const JHN3: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }
const JHN4: HighlightScope = { versionId: 111, book: 'JHN', chapter: '4' }
const YELLOW = 'ffd43b'
const GREEN = '51cf66'

/** Never reached the server. */
const UNREACHABLE: HighlightsApiError = { kind: 'transient', message: 'offline' }
/** Reached it and was refused on auth grounds — the one droppable failure. */
const REFUSED: HighlightsApiError = { kind: 'auth', status: 401, message: 'no' }
const FORBIDDEN: HighlightsApiError = { kind: 'auth', status: 403, message: 'nope' }
/** Reached it and failed for any other reason. Retried forever, never dropped. */
const SERVER_ERROR: HighlightsApiError = { kind: 'transient', status: 500, message: 'boom' }
const UNPROCESSABLE: HighlightsApiError = { kind: 'transient', status: 422, message: 'bad' }

type Call = { kind: 'create' | 'delete'; passageId: string; color?: string }

type CreateResult = Awaited<ReturnType<HighlightsApi['createHighlight']>>

type CreateData = Parameters<HighlightsApi['createHighlight']>[1]

/** `onCreate` chooses the POST's answer per call; the attempt is recorded either way. */
function createApi({
  onCreate,
  ...overrides
}: Partial<HighlightsApi> & {
  onCreate?: (data: CreateData) => CreateResult | Promise<CreateResult>
} = {}) {
  const calls: Call[] = []
  const createHighlight = jest.fn(async (_token: string, data: CreateData) => {
    calls.push({ kind: 'create', passageId: data.passage_id, color: data.color })
    return onCreate ? await onCreate(data) : ok(EMPTY_CREATED)
  })
  const api: HighlightsApi = {
    getHighlights: jest.fn(async () => ok({ data: [], next_page_token: null })),
    createHighlight,
    deleteHighlight: jest.fn(async (_token, passageId) => {
      calls.push({ kind: 'delete', passageId })
      return ok(undefined)
    }),
    ...overrides,
  }
  return { api, calls, createHighlight }
}

function signedIn(overrides: Partial<DrainAuth> = {}): () => DrainAuth {
  const auth: DrainAuth = {
    userId: USER,
    accessToken: 'token-1',
    ensureFreshToken: null,
    getAccessToken: null,
    ...overrides,
  }
  return () => auth
}

function mintedToken(token = 'token-1'): NonNullable<DrainAuth['getAccessToken']> {
  return jest.fn(async () => ({ status: 'ok' as const, token, userId: USER }))
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
  mmkvStorage.clearAll()
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
    mmkvStorage.set(
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

  it.each([
    ['the server cannot be reached', UNREACHABLE],
    ['the server answers 5xx', SERVER_ERROR],
    ['the server answers a non-auth 4xx', UNPROCESSABLE],
  ])('keeps the entry, and so the paint, when %s', async (_case, error) => {
    queueApply(JHN3, [16], YELLOW)
    const getAccessToken = mintedToken()
    const { api, calls } = createApi({ onCreate: () => err(error) })

    const drain = startHighlightQueueDrain({ api, getAuth: signedIn({ getAccessToken }) })
    drain.drainNow()
    await settle()
    drain.stop()

    // One attempt, no forced refresh: only an auth refusal earns a second look.
    expect(calls).toHaveLength(1)
    expect(getAccessToken).not.toHaveBeenCalled()
    expect(getQueuedWrites(USER, JHN3)).toEqual({ 16: { local: YELLOW, server: null } })
    expect(getCachedHighlights(USER, JHN3)).toBeNull()
  })

  describe('a write the server refuses', () => {
    /** Refuses the first attempt, then answers `then`. */
    function refusingOnce(then: () => CreateResult) {
      let attempts = 0
      return () => (++attempts === 1 ? err(REFUSED) : then())
    }

    it('mints a fresh token and states the write once more', async () => {
      queueApply(JHN3, [16], YELLOW)
      const getAccessToken = mintedToken('fresh')
      const { api, calls } = createApi({
        onCreate: refusingOnce(() => ok(EMPTY_CREATED)),
      })

      const drain = startHighlightQueueDrain({ api, getAuth: signedIn({ getAccessToken }) })
      drain.drainNow()
      await settle()
      drain.stop()

      expect(getAccessToken).toHaveBeenCalledTimes(1)
      expect(getAccessToken).toHaveBeenCalledWith({ force: true })
      expect(calls).toEqual([
        { kind: 'create', passageId: 'JHN.3.16', color: YELLOW },
        { kind: 'create', passageId: 'JHN.3.16', color: YELLOW },
      ])
      expect(getQueuedWrites(USER, JHN3)).toEqual({})
      expect(getCachedHighlights(USER, JHN3)).toEqual([
        { version_id: 111, passage_id: 'JHN.3.16', color: YELLOW },
      ])
    })

    it('sends the retry under the token the refresh minted', async () => {
      queueApply(JHN3, [16], YELLOW)
      let auth: DrainAuth = {
        userId: USER,
        accessToken: 'stale',
        ensureFreshToken: null,
        getAccessToken: async () => {
          auth = { ...auth, accessToken: 'fresh' }
          return { status: 'ok', token: 'fresh', userId: USER }
        },
      }
      const { api, createHighlight } = createApi({
        onCreate: refusingOnce(() => ok(EMPTY_CREATED)),
      })

      const drain = startHighlightQueueDrain({ api, getAuth: () => auth })
      drain.drainNow()
      await settle()
      drain.stop()

      const tokens = createHighlight.mock.calls.map(([token]) => token)
      expect(tokens).toEqual(['stale', 'fresh'])
    })

    it.each([
      ['401', REFUSED],
      ['403', FORBIDDEN],
    ])('drops the entry when a %s survives the forced refresh', async (_status, error) => {
      queueApply(JHN3, [16], YELLOW)
      const getAccessToken = mintedToken('fresh')
      const { api, calls } = createApi({ onCreate: () => err(error) })

      const drain = startHighlightQueueDrain({ api, getAuth: signedIn({ getAccessToken }) })
      drain.drainNow()
      await settle()
      drain.stop()

      expect(getAccessToken).toHaveBeenCalledTimes(1)
      expect(getAccessToken).toHaveBeenCalledWith({ force: true })
      expect(calls).toHaveLength(2)
      expect(getQueuedWrites(USER, JHN3)).toEqual({})
    })

    it('un-paints the verse back to the color the server had', async () => {
      // The cache is the paint, so it already holds the optimistic yellow.
      setCachedHighlights(USER, JHN3, [
        { version_id: 111, passage_id: 'JHN.3.16', color: YELLOW },
        { version_id: 111, passage_id: 'JHN.3.17', color: GREEN },
      ])
      enqueueWrites({
        userId: USER,
        scope: JHN3,
        verses: [16],
        color: YELLOW,
        currentColors: { 16: GREEN },
      })
      const { api } = createApi({ onCreate: () => err(REFUSED) })

      const drain = startHighlightQueueDrain({
        api,
        getAuth: signedIn({ getAccessToken: mintedToken() }),
      })
      drain.drainNow()
      await settle()
      drain.stop()

      expect(getCachedHighlights(USER, JHN3)).toEqual([
        { version_id: 111, passage_id: 'JHN.3.16', color: GREEN },
        { version_id: 111, passage_id: 'JHN.3.17', color: GREEN },
      ])
    })

    it('un-paints the verse entirely when the server had nothing', async () => {
      setCachedHighlights(USER, JHN3, [{ version_id: 111, passage_id: 'JHN.3.16', color: YELLOW }])
      queueApply(JHN3, [16], YELLOW)
      const { api } = createApi({ onCreate: () => err(REFUSED) })

      const drain = startHighlightQueueDrain({
        api,
        getAuth: signedIn({ getAccessToken: mintedToken() }),
      })
      drain.drainNow()
      await settle()
      drain.stop()

      expect(getCachedHighlights(USER, JHN3)).toEqual([])
    })

    it('leaves every other entry alone, in its scope and in others', async () => {
      queueApply(JHN3, [16], YELLOW)
      queueApply(JHN3, [20], GREEN)
      queueApply(JHN4, [1], GREEN)
      const { api } = createApi({
        onCreate: (data) => (data.color === YELLOW ? err(REFUSED) : err(UNREACHABLE)),
      })

      const drain = startHighlightQueueDrain({
        api,
        getAuth: signedIn({ getAccessToken: mintedToken() }),
      })
      drain.drainNow()
      await settle()
      drain.stop()

      expect(getQueuedWrites(USER, JHN3)).toEqual({ 20: { local: GREEN, server: null } })
      expect(getQueuedWrites(USER, JHN4)).toEqual({ 1: { local: GREEN, server: null } })
    })

    it('keeps the entry when the retry fails for a different reason', async () => {
      queueApply(JHN3, [16], YELLOW)
      const { api, calls } = createApi({ onCreate: refusingOnce(() => err(UNREACHABLE)) })

      const drain = startHighlightQueueDrain({
        api,
        getAuth: signedIn({ getAccessToken: mintedToken() }),
      })
      drain.drainNow()
      await settle()
      drain.stop()

      expect(calls).toHaveLength(2)
      expect(getQueuedWrites(USER, JHN3)).toEqual({ 16: { local: YELLOW, server: null } })
    })

    it('keeps the entry when the forced refresh reports refresh-failed', async () => {
      queueApply(JHN3, [16], YELLOW)
      const getAccessToken = jest.fn(async () => ({
        status: 'unavailable' as const,
        reason: 'refresh-failed' as const,
      }))
      const { api, calls } = createApi({ onCreate: () => err(REFUSED) })

      const drain = startHighlightQueueDrain({ api, getAuth: signedIn({ getAccessToken }) })
      drain.drainNow()
      await settle()
      drain.stop()

      expect(getAccessToken).toHaveBeenCalledWith({ force: true })
      expect(calls).toHaveLength(1)
      expect(getQueuedWrites(USER, JHN3)).toEqual({ 16: { local: YELLOW, server: null } })
    })

    it('keeps the entry when the forced refresh throws', async () => {
      queueApply(JHN3, [16], YELLOW)
      const { api, calls } = createApi({ onCreate: () => err(REFUSED) })

      const drain = startHighlightQueueDrain({
        api,
        getAuth: signedIn({
          getAccessToken: jest.fn(async () => {
            throw new Error('network down')
          }),
        }),
      })
      drain.drainNow()
      await settle()
      drain.stop()

      expect(calls).toHaveLength(1)
      expect(getQueuedWrites(USER, JHN3)).toEqual({ 16: { local: YELLOW, server: null } })
    })

    it('keeps the entry when there is no refresh to force', async () => {
      queueApply(JHN3, [16], YELLOW)
      const { api, calls } = createApi({ onCreate: () => err(REFUSED) })

      const drain = startHighlightQueueDrain({ api, getAuth: signedIn({ getAccessToken: null }) })
      drain.drainNow()
      await settle()
      drain.stop()

      // No mint means no second statement under a fresh token, so nothing the
      // server said qualifies as definitive.
      expect(calls).toHaveLength(1)
      expect(getQueuedWrites(USER, JHN3)).toEqual({ 16: { local: YELLOW, server: null } })
    })

    it('does not drop when the refresh ends the session it was retrying for', async () => {
      queueApply(JHN3, [16], YELLOW)
      let auth: DrainAuth = {
        userId: USER,
        accessToken: 'token-1',
        ensureFreshToken: null,
        getAccessToken: async () => {
          auth = { userId: null, accessToken: null, ensureFreshToken: null, getAccessToken: null }
          return { status: 'unavailable', reason: 'signed-out' }
        },
      }
      const { api, calls } = createApi({ onCreate: () => err(REFUSED) })

      const drain = startHighlightQueueDrain({ api, getAuth: () => auth })
      drain.drainNow()
      await settle()
      drain.stop()

      // Sign-out purges the queue itself; the drain must not be what decides the
      // departed user's write was refused for good.
      expect(calls).toHaveLength(1)
      expect(getQueuedWrites(USER, JHN3)).toEqual({ 16: { local: YELLOW, server: null } })
    })

    it('drops a refused removal, restoring the color it was removing', async () => {
      setCachedHighlights(USER, JHN3, [])
      enqueueWrites({
        userId: USER,
        scope: JHN3,
        verses: [16],
        color: null,
        currentColors: { 16: GREEN },
      })
      const { api } = createApi({
        deleteHighlight: jest.fn(async () => err(FORBIDDEN)),
      })

      const drain = startHighlightQueueDrain({
        api,
        getAuth: signedIn({ getAccessToken: mintedToken() }),
      })
      drain.drainNow()
      await settle()
      drain.stop()

      expect(api.deleteHighlight).toHaveBeenCalledTimes(2)
      expect(getQueuedWrites(USER, JHN3)).toEqual({})
      expect(getCachedHighlights(USER, JHN3)).toEqual([
        { version_id: 111, passage_id: 'JHN.3.16', color: GREEN },
      ])
    })
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

    let auth: DrainAuth = {
      userId: USER,
      accessToken: 'token-1',
      ensureFreshToken: null,
      getAccessToken: null,
    }
    const drain = startHighlightQueueDrain({ api, getAuth: () => auth })
    // Signs out during the refresh that precedes the first scope.
    auth = {
      userId: USER,
      accessToken: 'token-1',
      ensureFreshToken: async () => {
        auth = {
          userId: 'user-2',
          accessToken: 'token-2',
          ensureFreshToken: null,
          getAccessToken: null,
        }
      },
      getAccessToken: null,
    }
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([])
  })

  it('abandons the remaining scopes when the user changes after the first one is sent', async () => {
    queueApply(JHN3, [16], YELLOW)
    queueApply(JHN4, [1], YELLOW)

    let auth: DrainAuth = {
      userId: USER,
      accessToken: 'token-1',
      ensureFreshToken: null,
      getAccessToken: null,
    }
    const { api, calls, createHighlight } = createApi({
      onCreate: () => {
        auth = {
          userId: 'user-2',
          accessToken: 'token-2',
          ensureFreshToken: null,
          getAccessToken: null,
        }
        return ok(EMPTY_CREATED)
      },
    })

    const drain = startHighlightQueueDrain({ api, getAuth: () => auth })
    drain.drainNow()
    await settle()
    drain.stop()

    expect(calls).toEqual([{ kind: 'create', passageId: 'JHN.3.16', color: YELLOW }])
    expect(createHighlight.mock.calls.map(([token]) => token)).toEqual([
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
        return ok(EMPTY_CREATED)
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
      onCreate: () => (reachable ? ok(EMPTY_CREATED) : err(UNREACHABLE)),
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
