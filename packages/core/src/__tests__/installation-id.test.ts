import * as Crypto from 'expo-crypto'
import { MMKV_KEYS } from '../constants'
import { getOrSetInstallationId } from '../installation-id'
import { mmkvStorage } from '../storage/mmkv-storage'

let mockRandomUUID: jest.SpiedFunction<typeof Crypto.randomUUID>

beforeEach(() => {
  mmkvStorage.clearAll()
  mockRandomUUID = jest.spyOn(Crypto, 'randomUUID')
  mockRandomUUID.mockClear()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('getOrSetInstallationId', () => {
  it('returns the cached id without generating a new UUID', () => {
    mmkvStorage.set(MMKV_KEYS.installationId, 'pre-stored')

    const id = getOrSetInstallationId()

    expect(id).toBe('pre-stored')
    expect(mockRandomUUID).not.toHaveBeenCalled()
  })

  it('generates and persists a random UUID when none is stored', () => {
    mockRandomUUID.mockReturnValue('uuid-fresh')

    const id = getOrSetInstallationId()

    expect(id).toBe('uuid-fresh')
    expect(mockRandomUUID).toHaveBeenCalledTimes(1)
    expect(mmkvStorage.getString(MMKV_KEYS.installationId)).toBe('uuid-fresh')
  })

  it('persists the generated id so subsequent calls skip generation', () => {
    mockRandomUUID.mockReturnValue('uuid-once')

    const first = getOrSetInstallationId()
    mockRandomUUID.mockClear()
    const second = getOrSetInstallationId()

    expect(second).toBe(first)
    expect(mockRandomUUID).not.toHaveBeenCalled()
  })
})
