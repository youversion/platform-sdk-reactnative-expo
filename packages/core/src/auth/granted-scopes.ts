import { z } from 'zod'

import { mmkvStorage } from '../storage/mmkv-storage'
import { DEFAULT_SCOPES, MMKV_AUTH_KEYS } from './constants'
import type { AuthScope } from './types'

const cachedScopesSchema = z.object({
  userId: z.string(),
  scopes: z.array(z.string()),
})

/**
 * `undefined` means the token response omitted `scope`, so the grant is unknown.
 * A present string is the grant, including an empty one.
 * Unknown tokens stay. The server can add a scope this SDK does not name yet.
 */
export function parseGrantedScopes(scope: string | undefined): string[] | null {
  if (scope === undefined) {
    return null
  }
  return scope.split(/\s+/).filter((part) => part.length > 0)
}

export function loadCachedGrantedScopes(userId: string | null): string[] | null {
  if (userId === null) {
    return null
  }
  try {
    const raw = mmkvStorage.getString(MMKV_AUTH_KEYS.grantedScopes)
    if (raw == null) {
      return null
    }
    const parsed = cachedScopesSchema.safeParse(JSON.parse(raw))
    if (!parsed.success || parsed.data.userId !== userId) {
      return null
    }
    return parsed.data.scopes
  } catch {
    return null
  }
}

export function saveGrantedScopes(userId: string | null, scopes: readonly string[]): void {
  if (userId === null) {
    return
  }
  try {
    mmkvStorage.set(MMKV_AUTH_KEYS.grantedScopes, JSON.stringify({ userId, scopes }))
  } catch {
    // The in-memory list is what this session reads. A failed cache write must not fail sign-in.
  }
}

export function clearGrantedScopes(): void {
  try {
    mmkvStorage.remove(MMKV_AUTH_KEYS.grantedScopes)
  } catch {
    // Callers still drop the in-memory list.
  }
}

/**
 * Host scopes win as the base. Extra scopes from this call are appended and duplicates drop.
 * No host list means the defaults, so an extra-only call still asks for profile and email.
 */
export function mergeSignInScopes(
  configured: readonly AuthScope[] | undefined,
  extra: readonly AuthScope[] | undefined,
): readonly AuthScope[] | undefined {
  if (extra === undefined) {
    return configured
  }
  const base = configured ?? DEFAULT_SCOPES
  return [...new Set([...base, ...extra])]
}
