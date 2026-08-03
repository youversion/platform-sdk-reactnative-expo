import { z } from 'zod'
import { mmkvStorage } from '../storage/mmkv-storage'
import { MMKV_AUTH_KEYS } from './constants'

/**
 * The cached grant is scoped to the user it was issued for. There is only ever
 * one signed-in user, so this is a single key rather than a keyspace — the
 * `userId` is stored alongside the grant purely so a stale entry from a previous
 * user reads as a miss instead of leaking across a re-sign-in.
 *
 * Kept apart from `granted-permissions.ts` (redirect parsing) because the two
 * change for different reasons and only this half touches MMKV: `pkce-flow.ts`
 * needs the parser and would otherwise drag the native module into its imports.
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
