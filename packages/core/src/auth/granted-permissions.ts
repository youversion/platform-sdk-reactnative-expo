import { parseGrantedPermissions } from '@youversion/platform-core'

// Deliberately restates the key spellings platform-core accepts: it keeps the
// pattern inline in parseGrantedPermissions and exports neither it nor a
// presence-detecting helper, and we must detect presence ourselves because
// parseGrantedPermissions collapses "absent" and "empty" into [].
// A parity test in __tests__/granted-permissions.test.ts fails if the two drift.
const GRANTED_PERMISSIONS_KEY_PATTERN = /^granted_permissions(?:\[\d*\])?$/

/**
 * Reads the permission grant off the OAuth app redirect, preserving the
 * three-state signal `parseGrantedPermissions` alone cannot express:
 * `null` = no key at all (nothing requested / unknown), `[]` = requested and
 * denied, populated = granted.
 *
 * These three states are the gateway's documented contract, not an inference:
 * the API gateway OpenAPI spec (`youversion-platform-developer-hub`,
 * `devdocs/apis/openapi.yaml`, `info.description`) states that a granted
 * callback carries a comma-separated list, that "when permissions were
 * requested but none were granted, the callback includes `granted_permissions=`
 * with an empty value", and that the key is omitted when none were requested.
 * Not yet confirmed against a live denial — the YPE-3706 spike never ran.
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
