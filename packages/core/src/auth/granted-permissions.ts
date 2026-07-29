import { parseGrantedPermissions } from '@youversion/platform-core'
import { z } from 'zod'
import { mmkvStorage } from '../storage/mmkv-storage'
import { MMKV_AUTH_KEYS } from './constants'

/**
 * Every spelling of the granted-permissions param that `parseGrantedPermissions`
 * accepts: bare `granted_permissions`, PHP-style `granted_permissions[]`, and
 * indexed `granted_permissions[0]`.
 */
const GRANTED_PERMISSIONS_KEY = /^granted_permissions(?:\[\d*\])?$/

/**
 * Reads the permission grant off an OAuth redirect's query params, preserving the
 * three-state signal that `parseGrantedPermissions` alone cannot express:
 *
 * - `null` — no `granted_permissions` key at all: nothing was requested (or the
 *   response predates the param). **Unknown**, not denied.
 * - `[]` — the key is present but empty: requested and **denied**.
 * - non-empty — the permissions the user actually granted.
 *
 * `parseGrantedPermissions` returns `[]` for both of the first two cases, so
 * presence detection lives here and the value parsing (comma/space packing,
 * repeated keys, de-duplication) stays with the platform package.
 *
 * Values are **not** narrowed to the {@link import('./types').AuthPermission}
 * union. Filtering an unrecognized value would silently turn "granted" into
 * "denied" the moment the server adds a permission we do not know about yet.
 */
export function readGrantedPermissions(params: URLSearchParams): string[] | null {
  let present = false
  for (const key of params.keys()) {
    if (GRANTED_PERMISSIONS_KEY.test(key)) {
      present = true
      break
    }
  }
  if (!present) {
    return null
  }
  return parseGrantedPermissions(params)
}

/**
 * The cached grant is scoped to the user it was issued for. There is only ever
 * one signed-in user, so this is a single key rather than a keyspace — the
 * `userId` is stored alongside the grant purely so a stale entry from a previous
 * user reads as a miss instead of leaking across a re-sign-in.
 */
const cachedGrantSchema = z.object({
  userId: z.string().nullable(),
  permissions: z.array(z.string()),
})

/**
 * Synchronous MMKV read of the cached grant for `userId`. Returns `null` on a
 * miss, on corrupt/legacy JSON, or when the entry belongs to a different user;
 * never throws. Mirrors `loadCachedUserInfo` so the provider can seed its state
 * in a `useState` initializer and answer `hasPermission` on the first render.
 */
export function loadCachedGrantedPermissions(userId: string | null): string[] | null {
  try {
    const raw = mmkvStorage.getString(MMKV_AUTH_KEYS.grantedPermissions)
    if (raw == null) {
      return null
    }
    const parsed = cachedGrantSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return null
    }
    if (parsed.data.userId !== userId) {
      return null
    }
    return parsed.data.permissions
  } catch {
    return null
  }
}

/**
 * Persists a grant for `userId`. Only ever called with a non-null grant — an
 * absent MMKV entry *is* the unknown state, so a sign-in that reports no
 * `granted_permissions` must not overwrite a real grant with "unknown".
 */
export function saveGrantedPermissions(
  userId: string | null,
  permissions: readonly string[],
): void {
  mmkvStorage.set(MMKV_AUTH_KEYS.grantedPermissions, JSON.stringify({ userId, permissions }))
}

export function clearGrantedPermissions(): void {
  mmkvStorage.remove(MMKV_AUTH_KEYS.grantedPermissions)
}
