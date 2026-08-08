/**
 * The one question sign-out asks the queue: does signing this user out cost them
 * work the server never took?
 */
import {
  highlightQueueKey,
  highlightsCacheKey,
  MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX,
  type HighlightScope,
} from '../constants'
import { clearHighlightQueue, enqueueWrites, hasQueuedHighlightWrites } from '../queue'

const mockMmkv = new Map<string, string>()
let mockGetAllKeysThrows = false

jest.mock('../../storage/mmkv-storage', () => ({
  mmkvStorage: {
    set: jest.fn((k: string, v: string) => {
      mockMmkv.set(k, v)
    }),
    getString: jest.fn((k: string) => mockMmkv.get(k)),
    remove: jest.fn((k: string) => {
      mockMmkv.delete(k)
    }),
    getAllKeys: jest.fn(() => {
      if (mockGetAllKeysThrows) throw new Error('mmkv unavailable')
      return Array.from(mockMmkv.keys())
    }),
    has: jest.fn((k: string) => mockMmkv.has(k)),
  },
}))

const scope: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }
const YELLOW = 'ffd43b'

beforeEach(() => {
  mockMmkv.clear()
  mockGetAllKeysThrows = false
})

describe('hasQueuedHighlightWrites', () => {
  it('is false with nothing queued', () => {
    expect(hasQueuedHighlightWrites('user-1')).toBe(false)
  })

  it('is true once a write is parked, and false again once it settles', () => {
    enqueueWrites({ userId: 'user-1', scope, verses: [1], color: YELLOW, currentColors: {} })
    expect(hasQueuedHighlightWrites('user-1')).toBe(true)

    clearHighlightQueue()
    expect(hasQueuedHighlightWrites('user-1')).toBe(false)
  })

  it('answers per user', () => {
    enqueueWrites({ userId: 'user-1', scope, verses: [1], color: YELLOW, currentColors: {} })

    expect(hasQueuedHighlightWrites('user-2')).toBe(false)
  })

  it('is false for a signed-out user, whoever else has writes parked', () => {
    enqueueWrites({ userId: 'user-1', scope, verses: [1], color: YELLOW, currentColors: {} })

    expect(hasQueuedHighlightWrites(null)).toBe(false)
  })

  it('ignores the highlights cache, which is not unsent work', () => {
    mockMmkv.set(highlightsCacheKey('user-1', scope), JSON.stringify({ 1: YELLOW }))

    expect(hasQueuedHighlightWrites('user-1')).toBe(false)
  })

  // A scope suffix `listQueuedScopes` would reject still counts. The drain cannot
  // send that entry, which makes it more certain to be lost, not less.
  it('counts an entry the drain could never address', () => {
    mockMmkv.set(`${MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX}user-1.garbage`, JSON.stringify({ 1: YELLOW }))

    expect(hasQueuedHighlightWrites('user-1')).toBe(true)
  })

  // Sign-out must stay reachable: an unreadable store answers "nothing to lose"
  // rather than throwing out of the gesture that raises the prompt.
  it('is false when the store cannot be read', () => {
    enqueueWrites({ userId: 'user-1', scope, verses: [1], color: YELLOW, currentColors: {} })
    expect(hasQueuedHighlightWrites('user-1')).toBe(true)

    mockGetAllKeysThrows = true
    expect(hasQueuedHighlightWrites('user-1')).toBe(false)
  })

  it('does not confuse one user id for another that shares its prefix', () => {
    mockMmkv.set(
      highlightQueueKey('user-10', scope),
      JSON.stringify({ 1: { local: YELLOW, server: null } }),
    )

    expect(hasQueuedHighlightWrites('user-1')).toBe(false)
    expect(hasQueuedHighlightWrites('user-10')).toBe(true)
  })
})
