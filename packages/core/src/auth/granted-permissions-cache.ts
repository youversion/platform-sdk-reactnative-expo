import { z } from 'zod'
import { mmkvStorage } from '../storage/mmkv-storage'
import { MMKV_AUTH_KEYS } from './constants'

// Single key, self-scoped by userId — there is only ever one signed-in user
// (mirrors cachedUserInfo). The stored userId makes a previous user's entry
// read as a miss instead of leaking across a re-sign-in.
const cachedGrantSchema = z.object({
  userId: z.string(),
  permissions: z.array(z.string()),
})

/**
 * Synchronous MMKV read of the cached grant for `userId`. Returns `null` on a
 * miss, corrupt JSON, or a userId mismatch; never throws. Mirrors
 * `loadCachedUserInfo` so the provider can seed state in a `useState`
 * initializer and answer `hasPermission` on the first render.
 *
 * A `null` userId is always a miss: `YVUserInfo.id` is optional, and two
 * unidentifiable users must not read each other's grant.
 */
export function loadCachedGrantedPermissions(userId: string | null): string[] | null {
  if (userId === null) {
    return null
  }
  try {
    const raw = mmkvStorage.getString(MMKV_AUTH_KEYS.grantedPermissions)
    if (raw == null) {
      return null
    }
    const parsed = cachedGrantSchema.safeParse(JSON.parse(raw))
    if (!parsed.success || parsed.data.userId !== userId) {
      return null
    }
    return parsed.data.permissions
  } catch {
    return null
  }
}

/**
 * Persists a grant for `userId`. A `null` userId is refused — an entry no user
 * can be identified by would match every unidentifiable user; the grant then
 * lives only in provider state for the session. Never throws: the cache only
 * seeds the first render, so a storage failure must not fail a sign-in whose
 * session already committed.
 */
export function saveGrantedPermissions(
  userId: string | null,
  permissions: readonly string[],
): void {
  if (userId === null) {
    return
  }
  try {
    mmkvStorage.set(MMKV_AUTH_KEYS.grantedPermissions, JSON.stringify({ userId, permissions }))
  } catch {
    // Cache write failed; the in-memory grant remains authoritative.
  }
}

/**
 * Order-preserving union of an existing grant and a newly reported one.
 *
 * A just-in-time data-exchange consent reports only the permissions *that flow*
 * asked for, so writing it through would erase anything granted earlier at
 * sign-in: a `highlights`-only consent must not drop a previously granted
 * `votd`. Existing entries keep their order so the cached list stays stable
 * across merges (a reordered list is a pointless MMKV write and a confusing
 * diff when debugging).
 */
export function mergeGrantedPermissions(
  existing: readonly string[],
  granted: readonly string[],
): string[] {
  return [...new Set([...existing, ...granted])]
}

/**
 * Removes the cached grant. Best-effort by design: the cached grant is a hint,
 * the server is the enforcement point, and a survived entry costs at most a
 * skipped prompt and a request the server denies. See
 * `docs/adr/0014-cached-grant-is-a-hint.md` before hardening this.
 *
 * The `catch` is not a detector, and reading it as one overstates what this can
 * promise: `MMKV.remove` returns `false` rather than throwing on a read-only
 * instance, so the entry can survive with nothing caught. It is here only so a
 * throw cannot abort the caller mid-sign-out. Nothing can be layered on top
 * either — an overwrite, a tombstone, or a retry is another *write* into the
 * store that just refused one (ADR 0014's 2026-08-11 amendment).
 */
export function clearGrantedPermissions(): void {
  try {
    mmkvStorage.remove(MMKV_AUTH_KEYS.grantedPermissions)
  } catch {
    // Cache removal failed; callers still drop the in-memory grant.
  }
}
