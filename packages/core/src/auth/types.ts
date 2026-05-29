import { DEFAULT_SCOPES } from './constants'

export type AuthScope = (typeof DEFAULT_SCOPES)[number]

export type AuthConfig = {
  redirectUri: string
  scopes?: readonly AuthScope[]
}

export type YVUserInfo = {
  id?: string
  name?: string
  email?: string
  avatarUrl?: string // resolved URL, not the {width} template the web SDK exposes
}
