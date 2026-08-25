/**
 * platform-core's `HighlightsClient` mints the `request_id` the highlights API
 * requires on every create by calling the global `crypto.randomUUID`. On React
 * Native (Hermes, Expo SDK 56) there is no global `crypto`, so it silently falls
 * back to a non-UUID id (`yvp-…`) that the API rejects with HTTP 422
 * (`uuid_parsing`) — breaking every highlight create from RN.
 *
 * We back `crypto.randomUUID` with `expo-crypto` (already a core dependency — the
 * same native UUID source used in installation-id.ts) so platform-core takes its
 * intended path and sends a real RFC-4122 v4 UUID. An existing native
 * `randomUUID` is never overridden.
 *
 * Only `randomUUID` is shimmed — the one thing platform-core needs — keeping the
 * surface we add to a consumer's runtime as small as it can be. The accepted
 * trade, recorded here because it cuts the other way: defining `crypto` at all
 * makes `typeof crypto !== 'undefined'` true while `getRandomValues` and `subtle`
 * stay undefined, so a library that gates on the object rather than the method
 * takes its real branch and hits a TypeError where it previously fell back to its
 * own path. Judged low-probability — maintained libraries feature-detect the
 * method — and contained while this module is only reachable through the
 * unexported highlights path. Revisit when `useHighlights` is exported from the
 * package index and the install becomes app-wide. See YPE-4192.
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
  // SAFETY: RN's TS lib omits `crypto`; we only add `randomUUID` when missing.
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

    // The null half of this guard is for the type-checker, not for runtime
    // paranoia: `crypto` is optional on `scope` and TypeScript does not narrow
    // through `Object.defineProperty`. Dropping it needs a non-null assertion,
    // which is an ESLint error in source (see AGENTS.md, Code Style).
    const cryptoScope = scope.crypto
    if (cryptoScope != null && cryptoScope.randomUUID == null) {
      cryptoScope.randomUUID = () => Crypto.randomUUID()
    }
  } catch {
    // Intentionally swallowed — see above.
  }
}

// Self-install on import so the shim is in place before any platform-core code runs.
ensureCryptoRandomUUID()
