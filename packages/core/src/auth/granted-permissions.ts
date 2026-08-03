import { parseGrantedPermissions } from '@youversion/platform-core'
import { z } from 'zod'
import { mmkvStorage } from '../storage/mmkv-storage'
import { MMKV_AUTH_KEYS } from './constants'

/**
 * Every spelling of the granted-permissions param that `parseGrantedPermissions`
 * accepts: bare `granted_permissions`, PHP-style `granted_permissions[]`, and
 * indexed `granted_permissions[0]`.
 *
 * Deliberately mirrors the private pattern inside `parseGrantedPermissions`
 * (`@youversion/platform-core@2.4.0`, `dist/index.js:1672`) because the package
 * collapses "absent" and "empty" into `[]`, so presence detection has to live
 * here. **Re-check this on every `@youversion/platform-core` bump**: if upstream
 * widens the accepted spellings, a grant the parser would have handled reads as
 * `null` ("unknown") here — silently, and in exactly the three-state signal this
 * module exists to preserve. The copy goes away once platform-core exposes a
 * `hasGrantedPermissions(params)`.
 */
const GRANTED_PERMISSIONS_KEY_PATTERN = /^granted_permissions(?:\[\d*\])?$/

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
    if (GRANTED_PERMISSIONS_KEY_PATTERN.test(key)) {
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
 *
 * Never throws, mirroring {@link loadCachedGrantedPermissions}: the cache only
 * seeds the first render, so a native storage failure must not reject a sign-in
 * whose session already committed, nor skip the in-memory state update that
 * `hasPermission` actually reads. An entry stranded by a failed write is safe —
 * it stays scoped to whatever `userId` it was written for, so it reads as a
 * miss on the next cold start rather than leaking across users.
 */
export function saveGrantedPermissions(
  userId: string | null,
  permissions: readonly string[],
): void {
  try {
    mmkvStorage.set(MMKV_AUTH_KEYS.grantedPermissions, JSON.stringify({ userId, permissions }))
  } catch {
    // Cache write failed; the in-memory grant remains authoritative.
  }
}

/** Removes the cached grant. Never throws — see {@link saveGrantedPermissions}. */
export function clearGrantedPermissions(): void {
  try {
    mmkvStorage.remove(MMKV_AUTH_KEYS.grantedPermissions)
  } catch {
    // Cache removal failed; callers still drop the in-memory grant.
  }
}
