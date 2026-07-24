import * as Crypto from 'expo-crypto'

import { ensureCryptoRandomUUID } from '../ensure-crypto-uuid'

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }))

const mockRandomUUID = Crypto.randomUUID as jest.Mock
const SHIM_UUID = '11111111-1111-4111-8111-111111111111'

const scope = globalThis as { crypto?: { randomUUID?: () => string } }
let originalCrypto: { randomUUID?: () => string } | undefined

function setCrypto(value: { randomUUID?: () => string } | undefined): void {
  Object.defineProperty(scope, 'crypto', { value, configurable: true, writable: true })
}

beforeEach(() => {
  originalCrypto = scope.crypto
  jest.clearAllMocks()
  mockRandomUUID.mockReturnValue(SHIM_UUID)
})

afterEach(() => {
  setCrypto(originalCrypto)
})

describe('ensureCryptoRandomUUID', () => {
  it('installs randomUUID backed by expo-crypto when no crypto global exists (RN Hermes)', () => {
    setCrypto(undefined)

    ensureCryptoRandomUUID()

    expect(typeof scope.crypto?.randomUUID).toBe('function')
    expect(scope.crypto?.randomUUID?.()).toBe(SHIM_UUID)
    expect(mockRandomUUID).toHaveBeenCalledTimes(1)
  })

  it('adds randomUUID when crypto exists but lacks it', () => {
    setCrypto({})

    ensureCryptoRandomUUID()

    expect(typeof scope.crypto?.randomUUID).toBe('function')
    expect(scope.crypto?.randomUUID?.()).toBe(SHIM_UUID)
  })

  it('never overrides a native crypto.randomUUID (browser, Node ≥ 19, fuller polyfill)', () => {
    const native = jest.fn(() => 'native-uuid')
    setCrypto({ randomUUID: native })

    ensureCryptoRandomUUID()

    expect(scope.crypto?.randomUUID).toBe(native)
    expect(native()).toBe('native-uuid')
    expect(mockRandomUUID).not.toHaveBeenCalled()
  })

  it('is idempotent — a second call keeps the first shim', () => {
    setCrypto(undefined)

    ensureCryptoRandomUUID()
    const first = scope.crypto?.randomUUID
    ensureCryptoRandomUUID()

    expect(scope.crypto?.randomUUID).toBe(first)
  })
})
