import { parseGrantedPermissions } from '@youversion/platform-core'

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
