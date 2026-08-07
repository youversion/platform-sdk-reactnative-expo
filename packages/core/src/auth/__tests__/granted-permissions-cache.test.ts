import { mmkvStorage } from '../../storage/mmkv-storage'
import { MMKV_AUTH_KEYS } from '../constants'
import {
  clearGrantedPermissions,
  loadCachedGrantedPermissions,
  mergeGrantedPermissions,
  saveGrantedPermissions,
} from '../granted-permissions-cache'

const mockMmkv = new Map<string, string>()

jest.mock('../../storage/mmkv-storage', () => ({
  mmkvStorage: {
    set: jest.fn((k: string, v: string) => {
      mockMmkv.set(k, v)
    }),
    getString: jest.fn((k: string) => mockMmkv.get(k)),
    remove: jest.fn((k: string) => mockMmkv.delete(k)),
    getAllKeys: jest.fn(() => Array.from(mockMmkv.keys())),
  },
}))

beforeEach(() => {
  mockMmkv.clear()
  jest.clearAllMocks()
})

describe('mergeGrantedPermissions', () => {
  it('unions a newly granted permission onto an existing grant', () => {
    // A just-in-time consent reports only what it asked for; replacing would
    // erase what the user granted at sign-in.
    expect(mergeGrantedPermissions(['votd'], ['highlights'])).toEqual(['votd', 'highlights'])
  })

  it('de-duplicates without reordering the existing grant', () => {
    expect(mergeGrantedPermissions(['votd', 'highlights'], ['highlights', 'bibles'])).toEqual([
      'votd',
      'highlights',
      'bibles',
    ])
  })

  it('handles either side being empty', () => {
    expect(mergeGrantedPermissions([], ['highlights'])).toEqual(['highlights'])
    expect(mergeGrantedPermissions(['highlights'], [])).toEqual(['highlights'])
    expect(mergeGrantedPermissions([], [])).toEqual([])
  })

  it('does not mutate its inputs', () => {
    const existing = ['votd']
    const granted = ['highlights']
    mergeGrantedPermissions(existing, granted)
    expect(existing).toEqual(['votd'])
    expect(granted).toEqual(['highlights'])
  })
})

describe('granted permissions cache', () => {
  it('round-trips a grant for the same user', () => {
    saveGrantedPermissions('u1', ['highlights', 'bibles'])
    expect(loadCachedGrantedPermissions('u1')).toEqual(['highlights', 'bibles'])
    expect(mmkvStorage.set).toHaveBeenCalledWith(
      MMKV_AUTH_KEYS.grantedPermissions,
      JSON.stringify({ userId: 'u1', permissions: ['highlights', 'bibles'] }),
    )
  })

  it('round-trips an empty (denied) grant as [] rather than a miss', () => {
    saveGrantedPermissions('u1', [])
    expect(loadCachedGrantedPermissions('u1')).toEqual([])
  })

  it('refuses to persist a grant for an unidentifiable user', () => {
    saveGrantedPermissions(null, ['highlights'])
    expect(mmkvStorage.set).not.toHaveBeenCalled()
    expect(mockMmkv.has(MMKV_AUTH_KEYS.grantedPermissions)).toBe(false)
  })

  it('reads a miss for a null user id rather than matching another unidentified user', () => {
    // A legacy entry from a build that did cache under a null id must not read
    // back as a hit for whichever unidentifiable user signs in next.
    mockMmkv.set(
      MMKV_AUTH_KEYS.grantedPermissions,
      JSON.stringify({ userId: null, permissions: ['highlights'] }),
    )
    expect(loadCachedGrantedPermissions(null)).toBeNull()
    expect(loadCachedGrantedPermissions('u1')).toBeNull()
  })

  it('reads a miss when nothing is cached', () => {
    expect(loadCachedGrantedPermissions('u1')).toBeNull()
  })

  it('reads a miss when the cached grant belongs to a different user', () => {
    saveGrantedPermissions('u1', ['highlights'])
    expect(loadCachedGrantedPermissions('u2')).toBeNull()
    expect(loadCachedGrantedPermissions(null)).toBeNull()
  })

  it('reads a miss for corrupt JSON without throwing', () => {
    mockMmkv.set(MMKV_AUTH_KEYS.grantedPermissions, '{not json')
    expect(() => loadCachedGrantedPermissions('u1')).not.toThrow()
    expect(loadCachedGrantedPermissions('u1')).toBeNull()
  })

  it('reads a miss for a schema mismatch (wrong-typed payload)', () => {
    mockMmkv.set(
      MMKV_AUTH_KEYS.grantedPermissions,
      JSON.stringify({ userId: 'u1', permissions: 'highlights' }),
    )
    expect(loadCachedGrantedPermissions('u1')).toBeNull()

    mockMmkv.set(MMKV_AUTH_KEYS.grantedPermissions, JSON.stringify(null))
    expect(loadCachedGrantedPermissions('u1')).toBeNull()
  })

  it('reads a miss when the underlying storage read throws', () => {
    ;(mmkvStorage.getString as jest.Mock).mockImplementationOnce(() => {
      throw new Error('storage offline')
    })
    expect(loadCachedGrantedPermissions('u1')).toBeNull()
  })

  it('clear removes only the granted-permissions key', () => {
    saveGrantedPermissions('u1', ['highlights'])
    mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify({ id: 'u1' }))

    clearGrantedPermissions()

    expect(mockMmkv.has(MMKV_AUTH_KEYS.grantedPermissions)).toBe(false)
    expect(mockMmkv.has(MMKV_AUTH_KEYS.cachedUserInfo)).toBe(true)
  })
})
