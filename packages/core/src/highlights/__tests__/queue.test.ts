/**
 * ADR 0018's value-comparison retirement: a queue entry is one verse's desired
 * end state, so an entry whose two sides agree asks for nothing and is dropped.
 *
 * The rule is intrinsic to the entry, because nothing stores raw server truth to
 * compare against later. Break it and the queue turns back into an operation
 * log: a verse the user applied and then removed offline sends the server a
 * DELETE for a highlight it never had, and a re-tap of the color already on the
 * server spends a request to change nothing.
 */
import { highlightQueueKey, type HighlightScope } from '../constants'
import { enqueueWrites, getQueuedWrites } from '../queue'

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

const scope: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }
const userId = 'user-1'

const YELLOW = 'fffe00'
const GREEN = '5dff79'
const BLUE = '00d6ff'

/** What survived to storage, not just what the call returned. */
function persisted() {
  const raw = mockMmkv.get(highlightQueueKey(userId, scope))
  return raw === undefined ? null : (JSON.parse(raw) as Record<string, unknown>)
}

function enqueue(input: {
  verses: readonly number[]
  color: string | null
  currentColors?: Record<number, string>
}) {
  return enqueueWrites({
    userId,
    scope,
    verses: input.verses,
    color: input.color,
    currentColors: input.currentColors ?? {},
  })
}

beforeEach(() => {
  mockMmkv.clear()
})

describe('an entry whose two sides agree is dropped', () => {
  it('owes nothing when the write asks for the color the server already has', () => {
    const queued = enqueue({ verses: [16], color: YELLOW, currentColors: { 16: YELLOW } })

    expect(queued).toEqual({})
    expect(persisted()).toBeNull()
  })

  it('owes nothing when a remove targets a verse the server never highlighted', () => {
    const queued = enqueue({ verses: [16], color: null, currentColors: {} })

    expect(queued).toEqual({})
    expect(persisted()).toBeNull()
  })

  // `local` is normalized before the comparison, so the API's casing cannot
  // resurrect an entry that asks for nothing.
  it('owes nothing when the only difference is the color casing', () => {
    const queued = enqueue({ verses: [16], color: 'FFFE00', currentColors: { 16: YELLOW } })

    expect(queued).toEqual({})
    expect(persisted()).toBeNull()
  })

  it('drops only the agreeing verse, and keeps the rest of the scope owed', () => {
    const queued = enqueue({
      verses: [16, 17],
      color: YELLOW,
      currentColors: { 16: YELLOW },
    })

    expect(queued).toEqual({ 17: { local: YELLOW, server: null } })
    expect(persisted()).toEqual({ 17: { local: YELLOW, server: null } })
  })
})

describe('an entry whose two sides disagree is kept', () => {
  it('records an apply over a different server color', () => {
    const queued = enqueue({ verses: [16], color: GREEN, currentColors: { 16: YELLOW } })

    expect(queued).toEqual({ 16: { local: GREEN, server: YELLOW } })
    expect(persisted()).toEqual({ 16: { local: GREEN, server: YELLOW } })
  })

  it('records an apply on a verse the server has nothing for', () => {
    const queued = enqueue({ verses: [16], color: YELLOW })

    expect(queued).toEqual({ 16: { local: YELLOW, server: null } })
  })

  it('records a remove of a highlight the server does have', () => {
    const queued = enqueue({ verses: [16], color: null, currentColors: { 16: YELLOW } })

    expect(queued).toEqual({ 16: { local: null, server: YELLOW } })
  })
})

// The `server` side is captured once, by the first write to a verse, so a second
// write compares against where the server actually had it — not against whatever
// the first write painted.
describe('a second write to a verse that already has an entry', () => {
  it('retires the entry when the user undoes an offline apply', () => {
    enqueue({ verses: [16], color: YELLOW })
    expect(persisted()).toEqual({ 16: { local: YELLOW, server: null } })

    // `currentColors` now shows YELLOW — the offline paint — but the entry's own
    // `server` side is what decides, and it is still `null`.
    const queued = enqueue({ verses: [16], color: null, currentColors: { 16: YELLOW } })

    expect(queued).toEqual({})
    expect(persisted()).toBeNull()
  })

  it('retires the entry when the user taps back to the color the server has', () => {
    enqueue({ verses: [16], color: YELLOW, currentColors: { 16: GREEN } })
    expect(persisted()).toEqual({ 16: { local: YELLOW, server: GREEN } })

    const queued = enqueue({ verses: [16], color: GREEN, currentColors: { 16: YELLOW } })

    expect(queued).toEqual({})
    expect(persisted()).toBeNull()
  })

  it('keeps one entry, carrying the original server side, when the intent changes again', () => {
    enqueue({ verses: [16], color: YELLOW, currentColors: { 16: GREEN } })

    const queued = enqueue({ verses: [16], color: BLUE, currentColors: { 16: YELLOW } })

    expect(queued).toEqual({ 16: { local: BLUE, server: GREEN } })
    expect(getQueuedWrites(userId, scope)).toEqual({ 16: { local: BLUE, server: GREEN } })
  })
})
