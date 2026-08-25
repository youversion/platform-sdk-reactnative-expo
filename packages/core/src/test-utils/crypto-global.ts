/**
 * Shared fixture for the suites that exercise the `crypto.randomUUID` shim
 * (see highlights/ensure-crypto-uuid.ts). Both of them have to fake a runtime
 * without a crypto global, because the test runner's own Node always has one.
 *
 * Restoring lives here rather than in each suite on purpose: `globalThis.crypto`
 * is process-wide, so a teardown that misses would leak a stubbed crypto into
 * every suite that runs after it.
 */

export type CryptoLike = { randomUUID?: () => string }

/** The id the mocked `expo-crypto` returns, so assertions can pin the source. */
export const SHIM_UUID = '11111111-1111-4111-8111-111111111111'

/** Reads the current crypto global without repeating the cast in every suite. */
export function cryptoGlobal(): CryptoLike | undefined {
  return globalThis.crypto
}

/**
 * Replaces `globalThis.crypto` for the duration of a test and returns the undo.
 * Pass `undefined` to reproduce RN Hermes, or an object to model a runtime with
 * a partial (or complete) crypto.
 *
 * The global is replaced wholesale rather than mutated, so anything the shim
 * assigns lands on the stub and the runtime's real crypto is never touched. The
 * original property descriptor is restored — not just its value — because Node
 * defines `crypto` as an accessor, and putting a plain data property back in its
 * place would quietly change the global's shape for later suites.
 */
export function stubCryptoGlobal(value: CryptoLike | undefined): () => void {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')

  Object.defineProperty(globalThis, 'crypto', {
    value,
    configurable: true,
    writable: true,
  })

  return () => {
    if (original) {
      Object.defineProperty(globalThis, 'crypto', original)
    } else {
      Object.defineProperty(globalThis, 'crypto', {
        value: undefined,
        configurable: true,
        writable: true,
      })
    }
  }
}
