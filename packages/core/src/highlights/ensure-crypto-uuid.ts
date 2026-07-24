/**
 * platform-core's `HighlightsClient` mints the `request_id` the highlights API
 * requires on every create by calling the global `crypto.randomUUID`. On React
 * Native (Hermes, Expo SDK 56) there is no global `crypto`, so it silently falls
 * back to a non-UUID id (`yvp-…`) that the API rejects with HTTP 422
 * (`uuid_parsing`) — breaking every highlight create from RN.
 *
 * We back `crypto.randomUUID` with `expo-crypto` (already a core dependency — the
 * same native UUID source used in installation-id.ts) so platform-core takes its
 * intended path and sends a real RFC-4122 v4 UUID. Only `randomUUID` is shimmed;
 * we deliberately do not polyfill the rest of the Web Crypto surface (a partial
 * `getRandomValues`/`subtle` shim is a worse footgun than a missing one). An
 * existing native `randomUUID` is never overridden.
 *
 * Idempotent and self-installing on import — mirrors ui/lib/dom-local-storage.ts.
 * Import (and/or call) this before any platform-core client runs; api.ts does both.
 *
 * Long-term fix is upstream: platform-core should accept an injectable request_id
 * generator or emit a UUID-shaped fallback (see the request_id 422 bug). Remove
 * this shim once that ships.
 */
import * as Crypto from 'expo-crypto'

type CryptoLike = { randomUUID?: () => string }

/**
 * Ensures `globalThis.crypto.randomUUID` exists, backed by expo-crypto. No-ops
 * when the runtime already provides it (browsers, Node ≥ 19, a fuller polyfill).
 * Safe to call repeatedly and from any entry point.
 */
export function ensureCryptoRandomUUID(): void {
  const scope = globalThis as { crypto?: CryptoLike }

  // Defining/assigning a global can throw in locked-down runtimes. A failure
  // here must never take down a create — platform-core just keeps its own
  // fallback, which is no worse than not having attempted the shim.
  try {
    if (scope.crypto == null) {
      Object.defineProperty(scope, 'crypto', {
        value: {},
        configurable: true,
        writable: true,
      })
    }

    const cryptoScope = scope.crypto
    if (cryptoScope != null && typeof cryptoScope.randomUUID !== 'function') {
      cryptoScope.randomUUID = () => Crypto.randomUUID()
    }
  } catch {
    // Intentionally swallowed — see above.
  }
}

// Self-install on import so the shim is in place before any platform-core code runs.
ensureCryptoRandomUUID()
