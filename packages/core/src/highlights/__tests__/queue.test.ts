import type { HighlightScope } from '../constants'
import {
  backoffDelayMs,
  beginHighlightWrite,
  clearHighlightQueue,
  completePendingOp,
  enqueuePendingOp,
  getHighlightQueueGeneration,
  getHighlightQueueSnapshot,
  getPendingOps,
  hasPendingHighlightOperations,
  highlightQueueKey,
  isCurrentGeneration,
  nextPendingAttemptAt,
  peekDuePendingOp,
  QUEUE_INITIAL_BACKOFF_MS,
  QUEUE_MAX_BACKOFF_MS,
  QUEUE_STALE_OP_MAX_AGE_MS,
  reschedulePendingOp,
  retainPendingVerses,
  subscribeHighlightQueue,
  supersedePendingVerses,
  type PendingOp,
} from '../queue'

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
  },
}))

const USER = 'user-1'
const YELLOW = 'fffe00'
const GREEN = '5dff79'
const scope: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }

const NOW = 1_700_000_000_000

function enqueue(overrides: Partial<Parameters<typeof enqueuePendingOp>[1]> = {}): PendingOp {
  const pending = enqueuePendingOp(USER, {
    op: 'apply',
    scope,
    color: YELLOW,
    verses: [16],
    now: NOW,
    ...overrides,
  })
  if (pending === null) {
    throw new Error('Expected the op to be enqueued.')
  }
  return pending
}

beforeEach(() => {
  mockMmkv.clear()
  // Also drops the in-memory snapshot cache and the in-flight count, both of
  // which are module state and outlive `mockMmkv.clear()`.
  clearHighlightQueue()
  jest.clearAllMocks()
})

describe('backoffDelayMs', () => {
  it('doubles from 2s and holds at 30s', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(backoffDelayMs)).toEqual([
      2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000,
    ])
  })

  it('never returns a negative or runaway delay for a nonsense attempt count', () => {
    expect(backoffDelayMs(0)).toBe(QUEUE_INITIAL_BACKOFF_MS)
    expect(backoffDelayMs(-5)).toBe(QUEUE_INITIAL_BACKOFF_MS)
    expect(backoffDelayMs(9_999)).toBe(QUEUE_MAX_BACKOFF_MS)
  })
})

describe('enqueuePendingOp', () => {
  it('records the write with the first retry already scheduled', () => {
    const pending = enqueue()

    expect(pending).toMatchObject({
      op: 'apply',
      scope,
      color: YELLOW,
      verses: [16],
      // The direct write that just failed is attempt 1, so the first retry waits
      // the full backoff rather than firing straight back into a dead network.
      attempts: 1,
      nextAttemptAt: NOW + QUEUE_INITIAL_BACKOFF_MS,
      createdAt: NOW,
      generation: getHighlightQueueGeneration(),
    })
    expect(getPendingOps(USER)).toEqual([pending])
  })

  it('ignores a write with no user id or no verses', () => {
    expect(enqueuePendingOp(null, { op: 'apply', scope, color: YELLOW, verses: [16] })).toBeNull()
    expect(enqueuePendingOp(USER, { op: 'apply', scope, color: YELLOW, verses: [] })).toBeNull()
    expect(mockMmkv.size).toBe(0)
  })

  it('mints a distinct id per op even within the same millisecond', () => {
    const first = enqueue()
    const second = enqueue({ verses: [17] })
    expect(first.id).not.toBe(second.id)
  })
})

describe('persistence', () => {
  it('round-trips through storage, scoped to the user in the key', () => {
    const pending = enqueue()

    // Simulate a cold start: nothing but what is on disk.
    const raw = mockMmkv.get(highlightQueueKey(USER))
    clearHighlightQueue()
    mockMmkv.set(highlightQueueKey(USER), raw ?? '')

    expect(getPendingOps(USER)).toEqual([{ ...pending, generation: getHighlightQueueGeneration() }])
  })

  it('re-stamps stored ops with the current generation so a cold start replays them', () => {
    enqueue()
    const raw = mockMmkv.get(highlightQueueKey(USER))
    // Two discards later, the counter has moved on — but anything still on disk
    // was written after the last one, so it is current by construction.
    clearHighlightQueue()
    clearHighlightQueue()
    mockMmkv.set(highlightQueueKey(USER), raw ?? '')

    const stored = getPendingOps(USER)[0]
    expect(stored).toBeDefined()
    expect(isCurrentGeneration(stored?.generation ?? -1)).toBe(true)
  })

  it('never hands one user another user’s queue', () => {
    enqueue()
    expect(getPendingOps('user-2')).toEqual([])
  })

  describe('untrusted payloads', () => {
    it.each([
      ['corrupt JSON', 'not json'],
      ['a non-object', JSON.stringify('apply')],
      ['a missing ops array', JSON.stringify({ userId: USER })],
      [
        'a user id that does not match its key',
        JSON.stringify({ userId: 'someone-else', ops: [] }),
      ],
      [
        'an op with no verses',
        JSON.stringify({
          userId: USER,
          ops: [
            {
              id: 'x',
              generation: 0,
              op: 'apply',
              scope,
              color: YELLOW,
              verses: [],
              attempts: 1,
              nextAttemptAt: NOW,
              createdAt: NOW,
            },
          ],
        }),
      ],
      [
        'an op with a bogus colour',
        JSON.stringify({
          userId: USER,
          ops: [
            {
              id: 'x',
              generation: 0,
              op: 'apply',
              scope,
              color: 'not-a-colour',
              verses: [16],
              attempts: 1,
              nextAttemptAt: NOW,
              createdAt: NOW,
            },
          ],
        }),
      ],
    ])('reads %s as an empty queue rather than trusting it', (_label, raw) => {
      mockMmkv.set(highlightQueueKey(USER), raw)
      expect(getPendingOps(USER)).toEqual([])
    })
  })

  it('returns a referentially stable snapshot between writes', () => {
    enqueue()
    expect(getHighlightQueueSnapshot(USER)).toBe(getHighlightQueueSnapshot(USER))
  })

  it('hands out a fresh snapshot after a mutation', () => {
    const before = getHighlightQueueSnapshot(USER)
    enqueue()
    expect(getHighlightQueueSnapshot(USER)).not.toBe(before)
  })
})

describe('peekDuePendingOp', () => {
  it('withholds the head until its backoff has elapsed', () => {
    const pending = enqueue()

    expect(peekDuePendingOp(USER, NOW)).toBeNull()
    expect(peekDuePendingOp(USER, pending.nextAttemptAt - 1)).toBeNull()
    expect(peekDuePendingOp(USER, pending.nextAttemptAt)).toEqual(pending)
  })

  it('is strictly head-of-line, so a remove can never overtake its apply', () => {
    const head = enqueue({ op: 'apply', verses: [16] })
    enqueue({ op: 'remove', verses: [16] })

    // Back the head off past the second op's window.
    reschedulePendingOp(USER, head.id, NOW + 10 * QUEUE_MAX_BACKOFF_MS)

    expect(peekDuePendingOp(USER, NOW + QUEUE_INITIAL_BACKOFF_MS)).toBeNull()
  })

  it('replays in the order the writes were made', () => {
    enqueue({ verses: [16] })
    enqueue({ verses: [17] })
    enqueue({ verses: [18] })

    expect(getPendingOps(USER).map((op) => op.verses)).toEqual([[16], [17], [18]])
  })

  it('drops ops that outlived the retry window, and keeps the rest', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const stale = enqueue({ verses: [16], now: NOW - QUEUE_STALE_OP_MAX_AGE_MS - 1 })
    const fresh = enqueue({ verses: [17] })

    expect(peekDuePendingOp(USER, NOW + QUEUE_INITIAL_BACKOFF_MS)?.id).toBe(fresh.id)
    expect(getPendingOps(USER).map((op) => op.id)).toEqual([fresh.id])
    expect(getPendingOps(USER).map((op) => op.id)).not.toContain(stale.id)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('has nothing to hand back for a signed-out reader', () => {
    enqueue()
    expect(peekDuePendingOp(null, NOW + QUEUE_INITIAL_BACKOFF_MS)).toBeNull()
    expect(nextPendingAttemptAt(null)).toBeNull()
  })
})

describe('reschedulePendingOp', () => {
  it('advances the attempt count and the next window', () => {
    const pending = enqueue()

    const rescheduled = reschedulePendingOp(USER, pending.id, NOW)

    expect(rescheduled).toMatchObject({
      attempts: 2,
      nextAttemptAt: NOW + backoffDelayMs(2),
      // The origin for the stale cutoff must not move with the backoff.
      createdAt: pending.createdAt,
    })
    expect(nextPendingAttemptAt(USER)).toBe(NOW + backoffDelayMs(2))
  })

  it('is a no-op for an op that is already gone', () => {
    expect(reschedulePendingOp(USER, 'nope', NOW)).toBeNull()
    expect(reschedulePendingOp(null, 'nope', NOW)).toBeNull()
  })
})

describe('completePendingOp / retainPendingVerses', () => {
  it('removes a finished op', () => {
    const pending = enqueue()
    completePendingOp(USER, pending.id)
    expect(getPendingOps(USER)).toEqual([])
    expect(mockMmkv.has(highlightQueueKey(USER))).toBe(false)
  })

  it('narrows an op to the verses that still need retrying', () => {
    const pending = enqueue({ verses: [16, 17, 18] })

    retainPendingVerses(USER, pending.id, [17])

    expect(getPendingOps(USER)).toEqual([expect.objectContaining({ verses: [17] })])
  })

  it('removes the op when nothing is left to retry', () => {
    const pending = enqueue({ verses: [16, 17] })
    retainPendingVerses(USER, pending.id, [])
    expect(getPendingOps(USER)).toEqual([])
  })

  it('leaves the op alone when every verse is still owed', () => {
    const pending = enqueue({ verses: [16, 17] })
    retainPendingVerses(USER, pending.id, [16, 17])
    expect(getPendingOps(USER)).toEqual([pending])
  })
})

describe('supersedePendingVerses', () => {
  it('drops verses a newer tap has claimed, so a stale retry cannot land after it', () => {
    enqueue({ color: YELLOW, verses: [16, 17] })

    supersedePendingVerses(USER, [16])

    expect(getPendingOps(USER)).toEqual([expect.objectContaining({ color: YELLOW, verses: [17] })])
  })

  it('removes an op the newer tap fully covers', () => {
    enqueue({ color: YELLOW, verses: [16] })
    supersedePendingVerses(USER, [16])
    expect(getPendingOps(USER)).toEqual([])
  })

  it('touches nothing when the verses are unrelated', () => {
    const pending = enqueue({ verses: [16] })
    supersedePendingVerses(USER, [20])
    expect(getPendingOps(USER)).toEqual([pending])
  })

  it('is a no-op with no user or no verses', () => {
    const pending = enqueue({ verses: [16] })
    supersedePendingVerses(null, [16])
    supersedePendingVerses(USER, [])
    expect(getPendingOps(USER)).toEqual([pending])
  })
})

describe('hasPendingHighlightOperations', () => {
  it('is true while the queue is non-empty', () => {
    expect(hasPendingHighlightOperations(USER)).toBe(false)
    const pending = enqueue()
    expect(hasPendingHighlightOperations(USER)).toBe(true)
    completePendingOp(USER, pending.id)
    expect(hasPendingHighlightOperations(USER)).toBe(false)
  })

  // Swift's #180: the queue looks empty in the window between taking an op and
  // hearing back about it, and a sign-out there loses the write silently.
  it('is true during the in-flight window with an empty queue', () => {
    const release = beginHighlightWrite()
    expect(hasPendingHighlightOperations(USER)).toBe(true)
    // Signed-out readers see it too — the write belongs to whoever started it.
    expect(hasPendingHighlightOperations(null)).toBe(true)

    release()
    expect(hasPendingHighlightOperations(USER)).toBe(false)
  })

  it('counts concurrent writes and ignores a double release', () => {
    const first = beginHighlightWrite()
    const second = beginHighlightWrite()

    first()
    first()
    expect(hasPendingHighlightOperations(USER)).toBe(true)

    second()
    expect(hasPendingHighlightOperations(USER)).toBe(false)
  })
})

describe('clearHighlightQueue', () => {
  it('wipes every user, leaving unrelated keys alone', () => {
    enqueue()
    enqueuePendingOp('user-2', { op: 'apply', scope, color: GREEN, verses: [1], now: NOW })
    mockMmkv.set('yvp.userInfo', '{"id":"user-1"}')

    clearHighlightQueue()

    expect(getPendingOps(USER)).toEqual([])
    expect(getPendingOps('user-2')).toEqual([])
    expect(mockMmkv.has('yvp.userInfo')).toBe(true)
  })

  it('bumps the generation so a result already on the wire is discarded', () => {
    const pending = enqueue()
    expect(isCurrentGeneration(pending.generation)).toBe(true)

    clearHighlightQueue()

    // The caller holding this op can now tell its result belongs to a session
    // that is over, and must not re-queue it onto the next account.
    expect(isCurrentGeneration(pending.generation)).toBe(false)
    expect(getHighlightQueueGeneration()).toBe(pending.generation + 1)
  })

  it('clears the in-flight count so the guard cannot latch on forever', () => {
    beginHighlightWrite()
    clearHighlightQueue()
    expect(hasPendingHighlightOperations(USER)).toBe(false)
  })
})

describe('subscribeHighlightQueue', () => {
  it('notifies on every mutation and stops after unsubscribing', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeHighlightQueue(listener)

    const pending = enqueue()
    reschedulePendingOp(USER, pending.id, NOW)
    completePendingOp(USER, pending.id)
    clearHighlightQueue()
    expect(listener).toHaveBeenCalledTimes(4)

    unsubscribe()
    enqueue()
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('notifies when a write goes on and off the wire', () => {
    const listener = jest.fn()
    subscribeHighlightQueue(listener)

    const release = beginHighlightWrite()
    expect(listener).toHaveBeenCalledTimes(1)
    release()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('survives a listener that unsubscribes while being notified', () => {
    const other = jest.fn()
    const unsubscribeSelf = subscribeHighlightQueue(() => unsubscribeSelf())
    subscribeHighlightQueue(other)

    expect(() => enqueue()).not.toThrow()
    expect(other).toHaveBeenCalledTimes(1)
  })
})

// ── Rehydration ──────────────────────────────────────────────────────────────
// The gap that let a device defect hide behind 40 green unit tests: every case
// above starts from `clearHighlightQueue()`, so none of them ever read an op
// this module did not itself just write. A relaunch does exactly that.

/** A fresh module registry — generation back at 0, snapshot cache empty. */
function coldStart(): typeof import('../queue') {
  let module!: typeof import('../queue')
  jest.isolateModules(() => {
    // A fresh module registry is the whole point: `import` is hoisted and
    // cached, so it cannot express "this process has never loaded queue.ts".
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    module = require('../queue') as typeof import('../queue')
  })
  return module
}

/** Writes the raw stored shape, as a previous session's process would have. */
function seedDisk(ops: unknown[], forUser = USER): void {
  mockMmkv.set(highlightQueueKey(forUser), JSON.stringify({ userId: forUser, ops }))
}

function storedOp(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '1785320776009.1',
    // A previous session's counter, deliberately not 0.
    generation: 3,
    op: 'apply',
    scope,
    color: YELLOW,
    verses: [7],
    attempts: 1,
    nextAttemptAt: NOW + QUEUE_INITIAL_BACKOFF_MS,
    createdAt: NOW,
    ...overrides,
  }
}

describe('a cold start with ops already on disk', () => {
  it('replays stored ops instead of starting empty', () => {
    seedDisk([storedOp()])
    const queue = coldStart()

    expect(queue.getPendingOps(USER)).toHaveLength(1)
    expect(queue.hasPendingHighlightOperations(USER)).toBe(true)
  })

  it('re-stamps a departed session’s generation as current, so nothing is discarded as stale', () => {
    seedDisk([storedOp({ generation: 3 })])
    const queue = coldStart()

    const head = queue.peekDuePendingOp(USER, NOW + 60_000)
    expect(head).not.toBeNull()
    expect(queue.isCurrentGeneration(head?.generation ?? -1)).toBe(true)
  })

  it('returns the stored head once its backoff has elapsed', () => {
    seedDisk([storedOp()])
    const queue = coldStart()

    expect(queue.peekDuePendingOp(USER, NOW)?.id).toBeUndefined()
    expect(queue.peekDuePendingOp(USER, NOW + QUEUE_INITIAL_BACKOFF_MS)?.id).toBe('1785320776009.1')
  })

  it('preserves enqueue order across the restart', () => {
    seedDisk([
      storedOp({ id: 'op-7', verses: [7] }),
      storedOp({ id: 'op-9', verses: [9] }),
      storedOp({ id: 'op-11', verses: [11] }),
    ])
    const queue = coldStart()

    expect(queue.getPendingOps(USER).map((op) => op.id)).toEqual(['op-7', 'op-9', 'op-11'])
  })

  it('drains stored ops one at a time, head first', () => {
    seedDisk([
      storedOp({ id: 'op-7', verses: [7] }),
      storedOp({ id: 'op-9', verses: [9] }),
      storedOp({ id: 'op-11', verses: [11] }),
    ])
    const queue = coldStart()
    const due = NOW + 60_000

    expect(queue.peekDuePendingOp(USER, due)?.id).toBe('op-7')
    queue.completePendingOp(USER, 'op-7')
    expect(queue.peekDuePendingOp(USER, due)?.id).toBe('op-9')
    queue.completePendingOp(USER, 'op-9')
    // The tail of a partly-drained queue must still come back, not wedge.
    expect(queue.peekDuePendingOp(USER, due)?.id).toBe('op-11')
    queue.completePendingOp(USER, 'op-11')
    expect(queue.getPendingOps(USER)).toEqual([])
  })

  it('enqueues a new op alongside stored ones rather than replacing them', () => {
    seedDisk([storedOp({ id: 'op-11', verses: [11] })])
    const queue = coldStart()

    queue.enqueuePendingOp(USER, {
      op: 'apply',
      scope,
      color: GREEN,
      verses: [10],
      now: NOW + 60_000,
    })

    expect(queue.getPendingOps(USER).map((op) => op.verses)).toEqual([[11], [10]])
  })

  it('wipes stored ops off disk on sign-out', () => {
    seedDisk([storedOp()])
    const queue = coldStart()

    queue.clearHighlightQueue()

    expect(mockMmkv.has(highlightQueueKey(USER))).toBe(false)
    expect(queue.hasPendingHighlightOperations(USER)).toBe(false)
  })

  it('ignores a stored queue whose embedded user id does not match its key', () => {
    mockMmkv.set(
      highlightQueueKey(USER),
      JSON.stringify({ userId: 'somebody-else', ops: [storedOp()] }),
    )

    expect(coldStart().getPendingOps(USER)).toEqual([])
  })
})

describe('an unreadable op on disk', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  afterAll(() => warn.mockRestore())

  it('does not hide the valid ops queued behind it', () => {
    seedDisk([
      storedOp({ id: 'good-1' }),
      storedOp({ id: 'bad', verses: [] }),
      storedOp({ id: 'good-2' }),
    ])

    expect(
      coldStart()
        .getPendingOps(USER)
        .map((op) => op.id),
    ).toEqual(['good-1', 'good-2'])
  })

  it('still reports the survivors as pending work', () => {
    seedDisk([storedOp({ id: 'bad', color: 'not-a-color' }), storedOp({ id: 'good' })])

    expect(coldStart().hasPendingHighlightOperations(USER)).toBe(true)
  })

  it('repairs the store so the bad entry is not re-parsed forever', () => {
    seedDisk([storedOp({ id: 'bad', verses: 'nonsense' }), storedOp({ id: 'good' })])
    coldStart().getPendingOps(USER)

    const stored = JSON.parse(mockMmkv.get(highlightQueueKey(USER)) ?? '{}') as {
      ops: { id: string }[]
    }
    expect(stored.ops.map((op) => op.id)).toEqual(['good'])
  })

  it('removes the key entirely when every stored op is unreadable', () => {
    seedDisk([storedOp({ verses: [] })])
    coldStart().getPendingOps(USER)

    expect(mockMmkv.has(highlightQueueKey(USER))).toBe(false)
  })

  it('reads nothing when the envelope itself is corrupt', () => {
    mockMmkv.set(highlightQueueKey(USER), 'not json at all')

    expect(coldStart().getPendingOps(USER)).toEqual([])
  })
})
