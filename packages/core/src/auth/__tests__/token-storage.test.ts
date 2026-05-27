import { mmkvStorage, secureStorage } from '../../storage'
import { MMKV_AUTH_KEYS, SECURE_STORAGE_KEYS } from '../constants'
import { loadTokens, saveTokens, type StoredTokens } from '../token-storage'

const mockSecureStore = new Map<string, string>()
const mockMmkv = new Map<string, string>()

jest.mock('../../storage', () => ({
  secureStorage: {
    get: jest.fn((k: string) => Promise.resolve(mockSecureStore.get(k) ?? null)),
    set: jest.fn((k: string, v: string) => {
      mockSecureStore.set(k, v)
      return Promise.resolve()
    }),
    remove: jest.fn((k: string) => {
      mockSecureStore.delete(k)
      return Promise.resolve()
    }),
  },
  mmkvStorage: {
    set: jest.fn((k: string, v: string) => {
      mockMmkv.set(k, v)
    }),
    getString: jest.fn((k: string) => mockMmkv.get(k)),
    remove: jest.fn((k: string) => mockMmkv.delete(k)),
  },
}))

const fullTokens: StoredTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  idToken: 'id',
  expiryDate: new Date('2030-01-01T00:00:00.000Z'),
}

beforeEach(() => {
  mockSecureStore.clear()
  mockMmkv.clear()
  jest.clearAllMocks()
})

describe('saveTokens', () => {
  it('writes each token under its SECURE_STORAGE_KEY', async () => {
    await saveTokens(fullTokens)
    expect(secureStorage.set).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.accessToken, 'access')
    expect(secureStorage.set).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.refreshToken, 'refresh')
    expect(secureStorage.set).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.idToken, 'id')
  })

  it('writes expiryDate as an ISO string under the MMKV_AUTH key', async () => {
    await saveTokens(fullTokens)
    expect(mmkvStorage.set).toHaveBeenCalledWith(
      MMKV_AUTH_KEYS.expiryDateISO,
      '2030-01-01T00:00:00.000Z',
    )
  })

  it('removes each secure value when its token is null', async () => {
    await saveTokens({ accessToken: null, refreshToken: null, idToken: null, expiryDate: null })
    expect(secureStorage.remove).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.accessToken)
    expect(secureStorage.remove).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.refreshToken)
    expect(secureStorage.remove).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.idToken)
    expect(secureStorage.set).not.toHaveBeenCalled()
  })

  it('removes the expiry MMKV entry when expiryDate is null', async () => {
    await saveTokens({ ...fullTokens, expiryDate: null })
    expect(mmkvStorage.remove).toHaveBeenCalledWith(MMKV_AUTH_KEYS.expiryDateISO)
    expect(mmkvStorage.set).not.toHaveBeenCalled()
  })

  it('mixes set and remove when some tokens are null and others are not', async () => {
    await saveTokens({
      accessToken: 'a',
      refreshToken: null,
      idToken: 'i',
      expiryDate: new Date('2030-01-01T00:00:00.000Z'),
    })
    expect(secureStorage.set).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.accessToken, 'a')
    expect(secureStorage.set).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.idToken, 'i')
    expect(secureStorage.remove).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.refreshToken)
  })
})

describe('loadTokens', () => {
  it('round-trips a full token set, reconstructing expiryDate from the ISO string', async () => {
    await saveTokens(fullTokens)
    expect(await loadTokens()).toEqual(fullTokens)
  })

  it('returns nulls for every field when nothing is stored', async () => {
    expect(await loadTokens()).toEqual({
      accessToken: null,
      refreshToken: null,
      idToken: null,
      expiryDate: null,
    })
  })
})

