import { DEFAULT_SCOPES } from './constants'

export type AuthScope = (typeof DEFAULT_SCOPES)[number]

/** The permissions this SDK version knows about. See {@link AuthPermission}. */
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
 * Deliberately an open union: the server can mint permissions this SDK version
 * does not know about, and `granted_permissions` echoes them back verbatim.
 * `(string & {})` keeps {@link KnownAuthPermission} in autocomplete while
 * accepting any string.
 */
export type AuthPermission = KnownAuthPermission | (string & {})

export type AuthConfig = {
  redirectUri: string
  scopes?: readonly AuthScope[]
  /**
   * {@link AuthPermission}s to request at sign-in. Requesting one is not the same
   * as being granted it — the user can deny on the consent screen and sign-in
   * still succeeds. Read the actual grant back via `grantedPermissions` /
   * `hasPermission` on `useYVAuth()`.
   */
  permissions?: readonly AuthPermission[]
}

export type YVUserInfo = {
  id?: string
  name?: string
  email?: string
  avatarUrl?: string // resolved URL, not the {width} template the web SDK exposes
}
