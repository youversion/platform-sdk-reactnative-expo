import * as Crypto from 'expo-crypto'
import { MMKV_KEYS } from '../constants'
import { getOrSetInstallationId } from '../installation-id'

const mockMmkv = new Map<string, string>()

jest.mock('../storage/mmkv-storage', () => ({
  mmkvStorage: {
    getString: jest.fn((k: string) => mockMmkv.get(k)),
    set: jest.fn((k: string, v: string) => {
      mockMmkv.set(k, v)
    }),
  },
}))

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}))

const mockRandomUUID = Crypto.randomUUID as jest.Mock

beforeEach(() => {
  mockMmkv.clear()
  jest.clearAllMocks()
})

describe('getOrSetInstallationId', () => {
  it('returns the cached id without generating a new UUID', () => {
    mockMmkv.set(MMKV_KEYS.installationId, 'pre-stored')

    const id = getOrSetInstallationId()

    expect(id).toBe('pre-stored')
    expect(mockRandomUUID).not.toHaveBeenCalled()
  })

  it('generates and persists a random UUID when none is stored', () => {
    mockRandomUUID.mockReturnValue('uuid-fresh')

    const id = getOrSetInstallationId()

    expect(id).toBe('uuid-fresh')
    expect(mockRandomUUID).toHaveBeenCalledTimes(1)
    expect(mockMmkv.get(MMKV_KEYS.installationId)).toBe('uuid-fresh')
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
