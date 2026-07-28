import { DEFAULT_SCOPES } from './constants'

export type AuthScope = (typeof DEFAULT_SCOPES)[number]

/** The permissions this SDK version knows the names of. Not a closed set. */
export type KnownAuthPermission =
  | 'bibles'
  | 'highlights'
  | 'votd'
  | 'demographics'
  | 'bible_activity'

/**
 * A YouVersion Platform permission.
 *
 * These are **not** OIDC scopes. They travel on `/auth/authorize` as a repeatable
 * `requested_permissions[]` query param, separate from `scope` — the auth server
 * silently drops unknown values from `scope`, so passing a permission there grants
 * nothing.
 *
 * Deliberately an **open** string union rather than a closed one, matching the
 * Swift SDK. Permissions are minted server-side (verse notes and others follow
 * `highlights`), and the server echoes whatever it granted as free-form strings —
 * a closed union would force this SDK to either drop a grant it doesn't have a
 * literal for, or ship a major version for every new permission. The listed
 * values still autocomplete; unknown ones type-check and round-trip intact.
 */
export type AuthPermission = KnownAuthPermission | (string & {})

export type AuthConfig = {
  redirectUri: string
  scopes?: readonly AuthScope[]
  /**
   * {@link AuthPermission}s to request at sign-in. Requesting one is not the same
   * as being granted it — the user can deny on the consent screen and sign-in
   * still succeeds. What the SDK believes was granted is on
   * `useYVAuth().grantedPermissions`, and a just-in-time grant for a permission
   * denied (or never requested) runs through `useYVAuth().requestPermission`.
   */
  permissions?: readonly AuthPermission[]
}

export type YVUserInfo = {
  id?: string
  name?: string
  email?: string
  avatarUrl?: string // resolved URL, not the {width} template the web SDK exposes
}
