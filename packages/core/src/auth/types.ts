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
   * {@link AuthPermission}s to request at sign-in. Requesting one is not the same
   * as being granted it — the user can deny on the consent screen and sign-in
   * still succeeds.
   *
   * Read back what was actually granted from `useYVAuth()`: `hasPermission(p)`
   * for a single check, or `grantedPermissions` for the whole list (`null` when
   * nothing was requested or no grant has been observed, `[]` when the user
   * denied). The grant is cached per user and survives a cold start.
   */
  permissions?: readonly AuthPermission[]
}

export type YVUserInfo = {
  id?: string
  name?: string
  email?: string
  avatarUrl?: string // resolved URL, not the {width} template the web SDK exposes
}
