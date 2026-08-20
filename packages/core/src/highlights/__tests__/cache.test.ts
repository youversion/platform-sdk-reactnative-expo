import type { Highlight } from '@youversion/platform-core'
import { mmkvStorage } from '../../storage/mmkv-storage'
import { MMKV_AUTH_KEYS } from '../../auth/constants'
import { MMKV_KEYS } from '../../constants'
import {
  clearHighlightsCache,
  deriveServerColors,
  expandPassageId,
  getCachedHighlights,
  highlightsCacheKey,
  parseChapterScopeFromUsfm,
  setCachedHighlights,
  type HighlightScope,
} from '../cache'

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

function highlight(passageId: string, color: string, versionId = scope.versionId): Highlight {
  return { version_id: versionId, passage_id: passageId, color }
}

beforeEach(() => {
  mockMmkv.clear()
  jest.clearAllMocks()
})

describe('highlights cache', () => {
  it('round-trips raw highlights with passage ids intact', () => {
    const highlights = [highlight('JHN.3.16-18', 'FFFE00'), highlight('JHN.3.20', 'AaBbCc')]

    setCachedHighlights(userId, scope, highlights)

    // The raw API shape survives the round trip — passage ids and ranges are
    // not flattened away, so the reader's controlled `highlights` prop and
    // passage-id-targeted deletes still work on a cold start.
    expect(getCachedHighlights(userId, scope)).toEqual(highlights)
    expect(mockMmkv.has(highlightsCacheKey(userId, scope))).toBe(true)
  })

  it('returns synchronously (not a Promise)', () => {
    setCachedHighlights(userId, scope, [highlight('JHN.3.1', 'fffe00')])
    const result = getCachedHighlights(userId, scope)
    expect(result).not.toBeInstanceOf(Promise)
    expect(typeof (result as { then?: unknown } | null)?.then).toBe('undefined')
  })

  it('returns null for corrupt or invalid cached payloads without throwing', () => {
    const key = highlightsCacheKey(userId, scope)

    mockMmkv.set(key, '{not-json')
    expect(getCachedHighlights(userId, scope)).toBeNull()

    // Legacy Server Colors payloads (the shape this cache used to persist).
    mockMmkv.set(key, JSON.stringify({ 16: 'fffe00' }))
    expect(getCachedHighlights(userId, scope)).toBeNull()

    mockMmkv.set(key, JSON.stringify([{ version_id: 111, passage_id: 'JHN.3.16' }]))
    expect(getCachedHighlights(userId, scope)).toBeNull()

    mockMmkv.set(key, JSON.stringify([highlight('JHN.3.16', 'gg0000')]))
    expect(getCachedHighlights(userId, scope)).toBeNull()

    mockMmkv.set(
      key,
      JSON.stringify([{ version_id: '111', passage_id: 'JHN.3.16', color: 'fffe00' }]),
    )
    expect(getCachedHighlights(userId, scope)).toBeNull()

    mockMmkv.set(key, JSON.stringify([{ version_id: 0, passage_id: 'JHN.3.16', color: 'fffe00' }]))
    expect(getCachedHighlights(userId, scope)).toBeNull()

    mockMmkv.set(key, JSON.stringify([highlight('', 'fffe00')]))
    expect(getCachedHighlights(userId, scope)).toBeNull()
  })

  it('treats an empty highlights list as a hit', () => {
    setCachedHighlights(userId, scope, [])
    expect(getCachedHighlights(userId, scope)).toEqual([])
  })

  it('misses on get and no-ops on set when userId is missing', () => {
    expect(getCachedHighlights('', scope)).toBeNull()

    setCachedHighlights('', scope, [highlight('JHN.3.1', 'fffe00')])
    expect(mmkvStorage.set).not.toHaveBeenCalled()
    expect(mockMmkv.size).toBe(0)
  })

  it('clears only yvp.highlights.* keys', () => {
    const highlightsKey = highlightsCacheKey(userId, scope)
    mockMmkv.set(highlightsKey, JSON.stringify([highlight('JHN.3.16', 'fffe00')]))
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, '{"id":"u1"}')
    mockMmkv.set(MMKV_AUTH_KEYS.expiryDateISO, '2026-01-01T00:00:00.000Z')
    mockMmkv.set(MMKV_KEYS.installationId, 'inst-1')

    clearHighlightsCache()

    expect(mockMmkv.has(highlightsKey)).toBe(false)
    expect(mockMmkv.get(MMKV_AUTH_KEYS.cachedUserInfo)).toBe('{"id":"u1"}')
    expect(mockMmkv.get(MMKV_AUTH_KEYS.expiryDateISO)).toBe('2026-01-01T00:00:00.000Z')
    expect(mockMmkv.get(MMKV_KEYS.installationId)).toBe('inst-1')
  })
})

describe('expandPassageId', () => {
  it('expands a single verse and a verse range', () => {
    expect(expandPassageId('JHN.3.16')).toEqual({ book: 'JHN', chapter: '3', verses: [16] })
    expect(expandPassageId('JHN.3.16-18')).toEqual({
      book: 'JHN',
      chapter: '3',
      verses: [16, 17, 18],
    })
  })

  it('rejects non-verse, malformed, reversed, and implausible passage ids', () => {
    expect(expandPassageId('JHN.3')).toBeNull() // chapter scope
    expect(expandPassageId('JHN')).toBeNull()
    expect(expandPassageId('JHN.3.16.18')).toBeNull()
    expect(expandPassageId('JHN..16')).toBeNull()
    expect(expandPassageId('JHN.3.abc')).toBeNull()
    expect(expandPassageId('JHN.3.16-')).toBeNull()
    expect(expandPassageId('JHN.3.18-16')).toBeNull() // reversed
    expect(expandPassageId('JHN.3.0')).toBeNull() // verse 0
    expect(expandPassageId('JHN.3.1-9999')).toBeNull() // implausibly large
    expect(expandPassageId('')).toBeNull()
  })
})

describe('parseChapterScopeFromUsfm', () => {
  it('returns book and chapter for chapter, verse, and verse-range USFM', () => {
    expect(parseChapterScopeFromUsfm('JHN.3')).toEqual({ book: 'JHN', chapter: '3' })
    expect(parseChapterScopeFromUsfm('JHN.3.16')).toEqual({ book: 'JHN', chapter: '3' })
    expect(parseChapterScopeFromUsfm('JHN.3.16-18')).toEqual({ book: 'JHN', chapter: '3' })
  })

  it('returns null for invalid USFM', () => {
    expect(parseChapterScopeFromUsfm('')).toBeNull()
    expect(parseChapterScopeFromUsfm('JHN')).toBeNull()
    expect(parseChapterScopeFromUsfm('JHN.3.16.18')).toBeNull()
    expect(parseChapterScopeFromUsfm('JHN..16')).toBeNull()
    expect(parseChapterScopeFromUsfm('JHN.3.abc')).toBeNull()
  })

  it('does not change expandPassageId’s rejection of chapter-scope USFM', () => {
    expect(expandPassageId('JHN.3')).toBeNull()
  })
})

describe('deriveServerColors', () => {
  it('projects verses and normalizes hex to lowercase', () => {
    const colors = deriveServerColors(
      [highlight('JHN.3.16', 'FFFE00'), highlight('JHN.3.17', 'AaBbCc')],
      scope,
    )
    expect(colors).toEqual({ 16: 'fffe00', 17: 'aabbcc' })
  })

  it('expands a range passage id across every verse it covers', () => {
    expect(deriveServerColors([highlight('JHN.3.16-18', 'fffe00')], scope)).toEqual({
      16: 'fffe00',
      17: 'fffe00',
      18: 'fffe00',
    })
  })

  it('ignores entries from a different version, book, or chapter', () => {
    const colors = deriveServerColors(
      [
        highlight('JHN.3.16', 'fffe00'),
        highlight('JHN.3.17', 'ff0000', 222), // other version
        highlight('MAT.3.18', 'ff0000'), // other book
        highlight('JHN.4.19', 'ff0000'), // other chapter
      ],
      scope,
    )
    expect(colors).toEqual({ 16: 'fffe00' })
  })

  it('skips malformed, reversed, and chapter-scope passage ids without throwing', () => {
    expect(() =>
      deriveServerColors(
        [
          highlight('JHN.3', 'fffe00'),
          highlight('JHN.3.18-16', 'fffe00'),
          highlight('JHN.3.abc', 'fffe00'),
          highlight('JHN.3.0', 'fffe00'),
          highlight('', 'fffe00'),
        ],
        scope,
      ),
    ).not.toThrow()

    expect(
      deriveServerColors(
        [
          highlight('JHN.3', 'fffe00'),
          highlight('JHN.3.18-16', 'fffe00'),
          highlight('JHN.3.abc', 'fffe00'),
          highlight('JHN.3.0', 'fffe00'),
          highlight('JHN.3.16', 'fffe00'),
        ],
        scope,
      ),
    ).toEqual({ 16: 'fffe00' })
  })

  it('lets later entries win on overlapping verses', () => {
    expect(
      deriveServerColors(
        [highlight('JHN.3.16-17', 'fffe00'), highlight('JHN.3.17', 'ff0000')],
        scope,
      ),
    ).toEqual({ 16: 'fffe00', 17: 'ff0000' })
  })

  it('returns an empty map for an empty list', () => {
    expect(deriveServerColors([], scope)).toEqual({})
  })

  it('derives Server Colors from what the cache round-trips', () => {
    setCachedHighlights(userId, scope, [highlight('JHN.3.16-18', 'FFFE00')])
    const cached = getCachedHighlights(userId, scope)
    expect(cached).not.toBeNull()
    expect(deriveServerColors(cached ?? [], scope)).toEqual({
      16: 'fffe00',
      17: 'fffe00',
      18: 'fffe00',
    })
  })

  it('drops invalid hex from paint projection', () => {
    expect(
      deriveServerColors(
        [
          highlight('JHN.3.16', 'fffe00'),
          highlight('JHN.3.17', 'gg0000'),
          highlight('JHN.3.18', '123456'),
        ],
        scope,
      ),
    ).toEqual({ 16: 'fffe00', 18: '123456' })
  })
})
