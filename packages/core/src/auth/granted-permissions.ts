import { parseGrantedPermissions } from '@youversion/platform-core'

// Every spelling parseGrantedPermissions accepts: bare `granted_permissions`,
// PHP-style `granted_permissions[]`, and indexed `granted_permissions[0]`.
// Mirrors the pattern inside `@youversion/platform-core@2.4.0` because the
// package collapses "absent" and "empty" into `[]`; re-check on version bumps.
const GRANTED_PERMISSIONS_KEY_PATTERN = /^granted_permissions(?:\[\d*\])?$/

/**
 * Reads the permission grant off the OAuth app redirect, preserving the
 * three-state signal `parseGrantedPermissions` alone cannot express:
 * `null` = no key at all (nothing requested / unknown), `[]` = requested and
 * denied, populated = granted.
 *
 * Values are not narrowed to known permissions — filtering an unrecognized
 * value would silently turn "granted" into "denied" when the server adds a
 * permission this SDK version predates.
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
