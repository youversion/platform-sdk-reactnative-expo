import { mmkvStorage } from '../../storage/mmkv-storage'
import { MMKV_AUTH_KEYS } from '../../auth/constants'
import { MMKV_KEYS } from '../../constants'
import {
  clearHighlightsCache,
  getServerColors,
  highlightsCacheKey,
  setServerColors,
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

beforeEach(() => {
  mockMmkv.clear()
  jest.clearAllMocks()
})

describe('highlights cache', () => {
  it('round-trips Server Colors and normalizes hex to lowercase', () => {
    setServerColors(userId, scope, { 16: 'FFFE00', 17: 'AaBbCc' })

    const result = getServerColors(userId, scope)

    expect(result).toEqual({ 16: 'fffe00', 17: 'aabbcc' })
    expect(mockMmkv.has(highlightsCacheKey(userId, scope))).toBe(true)
  })

  it('returns synchronously (not a Promise)', () => {
    setServerColors(userId, scope, { 1: 'fffe00' })
    const result = getServerColors(userId, scope)
    expect(result).not.toBeInstanceOf(Promise)
    expect(typeof (result as { then?: unknown } | null)?.then).toBe('undefined')
  })

  it('returns null for corrupt or invalid cached payloads without throwing', () => {
    const key = highlightsCacheKey(userId, scope)

    mockMmkv.set(key, '{not-json')
    expect(getServerColors(userId, scope)).toBeNull()

    mockMmkv.set(key, JSON.stringify({ 16: 123 }))
    expect(getServerColors(userId, scope)).toBeNull()

    mockMmkv.set(key, JSON.stringify({ 16: 'gg0000' }))
    expect(getServerColors(userId, scope)).toBeNull()

    mockMmkv.set(key, JSON.stringify({ '1.5': 'fffe00' }))
    expect(getServerColors(userId, scope)).toBeNull()

    mockMmkv.set(key, JSON.stringify({ '0': 'fffe00' }))
    expect(getServerColors(userId, scope)).toBeNull()

    mockMmkv.set(key, JSON.stringify({ '-1': 'fffe00' }))
    expect(getServerColors(userId, scope)).toBeNull()

    mockMmkv.set(key, JSON.stringify({ abc: 'fffe00' }))
    expect(getServerColors(userId, scope)).toBeNull()
  })

  it('treats an empty Server Colors map as a hit', () => {
    setServerColors(userId, scope, {})
    expect(getServerColors(userId, scope)).toEqual({})
  })

  it('misses on get and no-ops on set when userId is missing', () => {
    expect(getServerColors('', scope)).toBeNull()

    setServerColors('', scope, { 1: 'fffe00' })
    expect(mmkvStorage.set).not.toHaveBeenCalled()
    expect(mockMmkv.size).toBe(0)
  })

  it('clears only yvp.highlights.* keys', () => {
    const highlightsKey = highlightsCacheKey(userId, scope)
    mockMmkv.set(highlightsKey, JSON.stringify({ 1: 'fffe00' }))
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
