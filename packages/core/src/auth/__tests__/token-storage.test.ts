import { MMKV_AUTH_KEYS, SECURE_STORAGE_KEYS } from '../constants'
import { mmkvStorage } from '../../storage/mmkv-storage'
import { secureStorage } from '../../storage/secure-storage'
import { loadTokens, saveTokens, type StoredTokens } from '../token-storage'

const mockSecureStore = new Map<string, string>()

const fullTokens: StoredTokens = {
  accessToken: 'access',
  refreshToken: 'refresh',
  expiryDate: new Date('2030-01-01T00:00:00.000Z'),
}

beforeEach(() => {
  mockSecureStore.clear()
  mmkvStorage.clearAll()
  jest.spyOn(secureStorage, 'get').mockImplementation((k) =>
    Promise.resolve(mockSecureStore.get(k) ?? null),
  )
  jest.spyOn(secureStorage, 'set').mockImplementation((k, v) => {
    mockSecureStore.set(k, v)
    return Promise.resolve()
  })
  jest.spyOn(secureStorage, 'remove').mockImplementation((k) => {
    mockSecureStore.delete(k)
    return Promise.resolve()
  })
  jest.spyOn(mmkvStorage, 'set')
  jest.spyOn(mmkvStorage, 'remove')
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('saveTokens', () => {
  it('writes each token under its SECURE_STORAGE_KEY', async () => {
    await saveTokens(fullTokens)
    expect(secureStorage.set).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.accessToken, 'access')
    expect(secureStorage.set).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.refreshToken, 'refresh')
  })

  it('writes expiryDate as an ISO string under the MMKV_AUTH key', async () => {
    await saveTokens(fullTokens)
    expect(mmkvStorage.set).toHaveBeenCalledWith(
      MMKV_AUTH_KEYS.expiryDateISO,
      '2030-01-01T00:00:00.000Z',
    )
  })

  it('removes each secure value when its token is null', async () => {
    await saveTokens({ accessToken: null, refreshToken: null, expiryDate: null })
    expect(secureStorage.remove).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.accessToken)
    expect(secureStorage.remove).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.refreshToken)
    expect(secureStorage.set).not.toHaveBeenCalled()
  })

  it('removes the expiry MMKV entry when expiryDate is null', async () => {
    await saveTokens({ ...fullTokens, expiryDate: null })
    expect(mmkvStorage.remove).toHaveBeenCalledWith(MMKV_AUTH_KEYS.expiryDateISO)
    expect(mmkvStorage.set).not.toHaveBeenCalled()
  })

  // Expiry is a cache over the tokens. A refusal here must not fail the save:
  // sign-out clears tokens through this function before it clears the session,
  // so a throw after those writes would abort with the tokens already gone.
  it('resolves when the store refuses to remove the expiry', async () => {
    jest.mocked(mmkvStorage.remove).mockImplementationOnce(() => {
      throw new Error('mmkv is read-only')
    })

    await expect(
      saveTokens({ accessToken: null, refreshToken: null, expiryDate: null }),
    ).resolves.toBeUndefined()
    expect(secureStorage.remove).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.accessToken)
    expect(secureStorage.remove).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.refreshToken)
  })

  it('resolves when the store refuses to write the expiry', async () => {
    jest.mocked(mmkvStorage.set).mockImplementationOnce(() => {
      throw new Error('mmkv is read-only')
    })

    await expect(saveTokens(fullTokens)).resolves.toBeUndefined()
    expect(secureStorage.set).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.accessToken, 'access')
    expect(secureStorage.set).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.refreshToken, 'refresh')
  })

  it('mixes set and remove when some tokens are null and others are not', async () => {
    await saveTokens({
      accessToken: 'a',
      refreshToken: null,
      expiryDate: new Date('2030-01-01T00:00:00.000Z'),
    })
    expect(secureStorage.set).toHaveBeenCalledWith(SECURE_STORAGE_KEYS.accessToken, 'a')
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
      expiryDate: null,
    })
  })
})
