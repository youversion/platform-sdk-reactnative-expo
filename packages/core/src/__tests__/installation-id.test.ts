import * as Application from 'expo-application'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'
import { MMKV_KEYS } from '../constants'
import { getOrSetInstallationId } from '../installation-id'

const mockMmkv = new Map<string, string>()

// Platform object lives inside the factory so it's defined when the factory
// runs (during the initial `require('react-native')`); tests mutate `Platform.OS`
// via the imported reference below.
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }))

jest.mock('../storage', () => ({
  mmkvStorage: {
    getString: jest.fn((k: string) => mockMmkv.get(k)),
    set: jest.fn((k: string, v: string) => {
      mockMmkv.set(k, v)
    }),
  },
}))

jest.mock('expo-application', () => ({
  getIosIdForVendorAsync: jest.fn(),
  getAndroidId: jest.fn(),
}))

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
}))

const mockGetIosIdForVendorAsync = Application.getIosIdForVendorAsync as jest.Mock
const mockGetAndroidId = Application.getAndroidId as jest.Mock
const mockRandomUUID = Crypto.randomUUID as jest.Mock
const mockPlatform = Platform as { OS: 'ios' | 'android' | 'web' }

beforeEach(() => {
  mockMmkv.clear()
  mockPlatform.OS = 'ios'
  jest.clearAllMocks()
})

describe('getOrSetInstallationId', () => {
  it('returns the cached id without touching native APIs', async () => {
    mockMmkv.set(MMKV_KEYS.installationId, 'pre-stored')

    const id = await getOrSetInstallationId()

    expect(id).toBe('pre-stored')
    expect(mockGetIosIdForVendorAsync).not.toHaveBeenCalled()
    expect(mockGetAndroidId).not.toHaveBeenCalled()
    expect(mockRandomUUID).not.toHaveBeenCalled()
  })

  describe('on iOS', () => {
    beforeEach(() => {
      mockPlatform.OS = 'ios'
    })

    it('returns IDFV', async () => {
      mockGetIosIdForVendorAsync.mockResolvedValue('IDFV-123')
      expect(await getOrSetInstallationId()).toBe('IDFV-123')
    })

    it('falls back to a random UUID when IDFV is null', async () => {
      mockGetIosIdForVendorAsync.mockResolvedValue(null)
      mockRandomUUID.mockReturnValue('uuid-fallback')
      expect(await getOrSetInstallationId()).toBe('uuid-fallback')
    })
  })

  describe('on Android', () => {
    beforeEach(() => {
      mockPlatform.OS = 'android'
    })

    it('returns AndroidId', async () => {
      mockGetAndroidId.mockReturnValue('ANDROID-456')
      expect(await getOrSetInstallationId()).toBe('ANDROID-456')
    })

    it('falls back to a random UUID when AndroidId is null', async () => {
      mockGetAndroidId.mockReturnValue(null)
      mockRandomUUID.mockReturnValue('uuid-fallback')
      expect(await getOrSetInstallationId()).toBe('uuid-fallback')
    })
  })

  it('uses a random UUID directly on non-mobile platforms (e.g. web)', async () => {
    mockPlatform.OS = 'web'
    mockRandomUUID.mockReturnValue('uuid-web')
    expect(await getOrSetInstallationId()).toBe('uuid-web')
  })

  it('persists the generated id so subsequent calls skip the device APIs', async () => {
    mockPlatform.OS = 'ios'
    mockGetIosIdForVendorAsync.mockResolvedValue('IDFV-123')

    const first = await getOrSetInstallationId()
    mockGetIosIdForVendorAsync.mockClear()
    const second = await getOrSetInstallationId()

    expect(second).toBe(first)
    expect(mockGetIosIdForVendorAsync).not.toHaveBeenCalled()
  })
})
