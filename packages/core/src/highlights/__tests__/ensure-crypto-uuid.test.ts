import * as Crypto from 'expo-crypto'

import { cryptoGlobal, SHIM_UUID, stubCryptoGlobal } from '../../test-utils/crypto-global'
import { ensureCryptoRandomUUID } from '../ensure-crypto-uuid'

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }))

const mockRandomUUID = Crypto.randomUUID as jest.Mock

let restoreCrypto: (() => void) | undefined

beforeEach(() => {
  jest.clearAllMocks()
  mockRandomUUID.mockReturnValue(SHIM_UUID)
})

afterEach(() => {
  restoreCrypto?.()
  restoreCrypto = undefined
})

describe('ensureCryptoRandomUUID', () => {
  it('installs randomUUID backed by expo-crypto when no crypto global exists (RN Hermes)', () => {
    restoreCrypto = stubCryptoGlobal(undefined)

    ensureCryptoRandomUUID()

    expect(typeof cryptoGlobal()?.randomUUID).toBe('function')
    expect(cryptoGlobal()?.randomUUID?.()).toBe(SHIM_UUID)
    expect(mockRandomUUID).toHaveBeenCalledTimes(1)
  })

  it('adds randomUUID when crypto exists but lacks it', () => {
    restoreCrypto = stubCryptoGlobal({})

    ensureCryptoRandomUUID()

    expect(typeof cryptoGlobal()?.randomUUID).toBe('function')
    expect(cryptoGlobal()?.randomUUID?.()).toBe(SHIM_UUID)
  })

  it('never overrides a native crypto.randomUUID (browser, Node ≥ 19, fuller polyfill)', () => {
    const native = jest.fn(() => 'native-uuid')
    restoreCrypto = stubCryptoGlobal({ randomUUID: native })

    ensureCryptoRandomUUID()

    expect(cryptoGlobal()?.randomUUID).toBe(native)
    expect(native()).toBe('native-uuid')
    expect(mockRandomUUID).not.toHaveBeenCalled()
  })

  it('is idempotent — a second call keeps the first shim', () => {
    restoreCrypto = stubCryptoGlobal(undefined)

    ensureCryptoRandomUUID()
    const first = cryptoGlobal()?.randomUUID
    ensureCryptoRandomUUID()

    expect(cryptoGlobal()?.randomUUID).toBe(first)
  })
})
