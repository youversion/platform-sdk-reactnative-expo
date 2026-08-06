import {
  addGrantedPermissions,
  clearGrantedPermissions,
  getGrantedPermissions,
  grantedPermissionsKey,
  invalidateGrantedPermission,
  saveGrantedPermissions,
  subscribeGrantedPermissions,
} from '../granted-permissions'

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

beforeEach(() => {
  mockMmkv.clear()
  // Also drops the in-memory snapshot cache, which outlives a single test.
  clearGrantedPermissions()
  jest.clearAllMocks()
})

describe('getGrantedPermissions', () => {
  it('returns null — "unknown" — for a signed-out reader, distinct from an empty grant', () => {
    expect(getGrantedPermissions(null)).toBeNull()
    expect(getGrantedPermissions('')).toBeNull()

    saveGrantedPermissions(USER, [])
    expect(getGrantedPermissions(USER)).toEqual([])
  })

  it('reads back what was saved, deduped', () => {
    saveGrantedPermissions(USER, ['highlights', 'highlights', 'votd'])
    expect(getGrantedPermissions(USER)).toEqual(['highlights', 'votd'])
  })

  it('scopes grants to the user who was granted them', () => {
    saveGrantedPermissions(USER, ['highlights'])
    expect(getGrantedPermissions('user-2')).toBeNull()
  })

  it('keeps a permission this SDK version has no literal for', () => {
    saveGrantedPermissions(USER, ['verse_notes'])
    expect(getGrantedPermissions(USER)).toEqual(['verse_notes'])
  })

  it('returns a referentially stable snapshot between writes', () => {
    saveGrantedPermissions(USER, ['highlights'])
    expect(getGrantedPermissions(USER)).toBe(getGrantedPermissions(USER))
  })

  describe('untrusted payloads', () => {
    it.each([
      ['corrupt JSON', 'not json'],
      ['a non-object', JSON.stringify('highlights')],
      ['a missing permissions array', JSON.stringify({ userId: USER })],
      ['a wrong-typed permissions array', JSON.stringify({ userId: USER, permissions: [1, 2] })],
      [
        'a user id that does not match its key',
        JSON.stringify({ userId: 'someone-else', permissions: ['highlights'] }),
      ],
    ])('reads %s as unknown rather than trusting it', (_label, raw) => {
      mockMmkv.set(grantedPermissionsKey(USER), raw)
      expect(getGrantedPermissions(USER)).toBeNull()
    })
  })
})

describe('saveGrantedPermissions', () => {
  it('replaces the recorded set — a fresh sign-in defines it', () => {
    saveGrantedPermissions(USER, ['highlights', 'votd'])
    saveGrantedPermissions(USER, ['votd'])
    expect(getGrantedPermissions(USER)).toEqual(['votd'])
  })

  it('ignores a write with no user id', () => {
    saveGrantedPermissions('', ['highlights'])
    expect(mockMmkv.size).toBe(0)
  })
})

describe('addGrantedPermissions', () => {
  it('unions rather than replacing, so a just-in-time grant keeps sign-in grants', () => {
    saveGrantedPermissions(USER, ['votd'])
    addGrantedPermissions(USER, ['highlights'])
    expect(getGrantedPermissions(USER)).toEqual(['votd', 'highlights'])
  })

  it('records the first grant for a user with nothing recorded yet', () => {
    addGrantedPermissions(USER, ['highlights'])
    expect(getGrantedPermissions(USER)).toEqual(['highlights'])
  })

  it('is a no-op for an empty grant or a missing user id', () => {
    addGrantedPermissions(USER, [])
    addGrantedPermissions('', ['highlights'])
    expect(mockMmkv.size).toBe(0)
  })
})

describe('invalidateGrantedPermission', () => {
  it('drops the named grant and keeps the rest', () => {
    saveGrantedPermissions(USER, ['highlights', 'votd'])
    invalidateGrantedPermission(USER, 'highlights')
    expect(getGrantedPermissions(USER)).toEqual(['votd'])
  })

  it('does not record an empty set for a user we know nothing about', () => {
    invalidateGrantedPermission(USER, 'highlights')
    expect(getGrantedPermissions(USER)).toBeNull()
    expect(mockMmkv.size).toBe(0)
  })

  it('is a no-op when the grant was never recorded', () => {
    saveGrantedPermissions(USER, ['votd'])
    invalidateGrantedPermission(USER, 'highlights')
    expect(getGrantedPermissions(USER)).toEqual(['votd'])
  })
})

describe('clearGrantedPermissions', () => {
  it('wipes every user, leaving unrelated keys alone', () => {
    saveGrantedPermissions(USER, ['highlights'])
    saveGrantedPermissions('user-2', ['votd'])
    mockMmkv.set('yvp.userInfo', '{"id":"user-1"}')

    clearGrantedPermissions()

    expect(getGrantedPermissions(USER)).toBeNull()
    expect(getGrantedPermissions('user-2')).toBeNull()
    expect(mockMmkv.has('yvp.userInfo')).toBe(true)
  })
})

describe('subscribeGrantedPermissions', () => {
  it('notifies on every mutation and stops after unsubscribing', () => {
    const listener = jest.fn()
    const unsubscribe = subscribeGrantedPermissions(listener)

    saveGrantedPermissions(USER, ['highlights'])
    addGrantedPermissions(USER, ['votd'])
    invalidateGrantedPermission(USER, 'highlights')
    clearGrantedPermissions()
    expect(listener).toHaveBeenCalledTimes(4)

    unsubscribe()
    saveGrantedPermissions(USER, ['highlights'])
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('survives a listener that unsubscribes while being notified', () => {
    const other = jest.fn()
    const unsubscribeSelf = subscribeGrantedPermissions(() => unsubscribeSelf())
    subscribeGrantedPermissions(other)

    expect(() => saveGrantedPermissions(USER, ['highlights'])).not.toThrow()
    expect(other).toHaveBeenCalledTimes(1)
  })

  it('hands out a fresh snapshot after a mutation', () => {
    saveGrantedPermissions(USER, ['highlights'])
    const before = getGrantedPermissions(USER)
    addGrantedPermissions(USER, ['votd'])
    expect(getGrantedPermissions(USER)).not.toBe(before)
  })
})
