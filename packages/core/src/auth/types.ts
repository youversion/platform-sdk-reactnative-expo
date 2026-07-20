import { DEFAULT_SCOPES } from './constants'

export type AuthScope = (typeof DEFAULT_SCOPES)[number]

/**
 * A YouVersion Platform permission.
 *
 * These are **not** OIDC scopes. They travel on `/auth/authorize` as a repeatable
 * `requested_permissions[]` query param, separate from `scope` — the auth server
 * silently drops unknown values from `scope`, so passing a permission there grants
 * nothing.
 */
export type AuthPermission = 'bibles' | 'highlights' | 'votd' | 'demographics' | 'bible_activity'

export type AuthConfig = {
  redirectUri: string
  scopes?: readonly AuthScope[]
  /**
   * YouVersion Platform permissions to request at sign-in, sent as repeated
   * `requested_permissions[]` params on `/auth/authorize`.
   *
   * These are **not** OIDC scopes — keep them out of `scopes`, which stays
   * `'profile' | 'email'`.
   *
   * Requesting a permission is not the same as being granted it: the user can
   * deny it on the consent screen and sign-in still succeeds. Reading back what
   * was actually granted is not yet supported.
   */
  permissions?: readonly AuthPermission[]
}

export type YVUserInfo = {
  id?: string
  name?: string
  email?: string
  avatarUrl?: string // resolved URL, not the {width} template the web SDK exposes
}
