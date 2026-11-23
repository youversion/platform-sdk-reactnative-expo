// INTERIM (YPE-6786): replaced by @youversion/platform-core once platform-sdk-react#497 ships. Delete this file when adopting it.
// Mirrors packages/core/src/auth-token.ts @ 10dd292a71aaf8fac5fe07aa46d5ff7c98a99b87.
// RN: 2.17 does not export resolveAuthToken. The configuration fallback is the same one.

import { YouVersionPlatformConfiguration } from '@youversion/platform-core'

/**
 * Resolves the auth token from an explicit `lat` or the ambient platform
 * configuration. Shared by the service clients (highlights, data exchange) so
 * they resolve the token identically.
 *
 * The implicit fallback reads from `YouVersionPlatformConfiguration`, which is
 * backed by browser `localStorage` and safely resolves to `null` in any
 * environment without a usable store (React Native, Node.js tests, SSR): those
 * callers must pass `lat` explicitly rather than relying on this fallback.
 *
 * @param lat Optional explicit long access token.
 * @param action Human-readable action for the error message tail (e.g.
 *   `'accessing highlights'`), rendered as
 *   `...sign in before <action>.`
 * @throws Error if no token is available.
 */
export function resolveAuthToken(lat: string | undefined, action: string): string {
  if (lat) {
    return lat
  }
  const token = YouVersionPlatformConfiguration.accessToken
  if (!token) {
    throw new Error(`Authentication required. Please provide a token or sign in before ${action}.`)
  }
  return token
}
