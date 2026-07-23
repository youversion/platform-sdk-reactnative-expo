import * as WebBrowser from 'expo-web-browser'
import { fetch } from 'expo/fetch'
import { getOrSetInstallationId } from '../installation-id'
import { DEFAULT_SCOPES } from './constants'
import { exchangeCodeForTokens, type TokenResponse } from './http'
import { decodeIdToken, deriveUserInfo } from './id-token'
import { generatePKCEParameters } from './pkce'
import type { AuthPermission, AuthScope, YVUserInfo } from './types'

export type SignInResult =
  | {
      kind: 'success'
      tokens: TokenResponse
      userInfo: YVUserInfo
    }
  | { kind: 'cancel' }

type SignInWithPKCEProps = {
  apiHost: string
  appKey: string
  redirectUri: string
  scopes?: readonly AuthScope[]
  permissions?: readonly AuthPermission[]
}

export async function signInWithPKCE({
  apiHost,
  appKey,
  redirectUri,
  scopes,
  permissions,
}: SignInWithPKCEProps): Promise<SignInResult> {
  const [{ codeVerifier, codeChallenge, nonce, state }, installationId] = await Promise.all([
    generatePKCEParameters(),
    getOrSetInstallationId(),
  ])
  const redirectUriString = redirectUri.endsWith('/') ? redirectUri.slice(0, -1) : redirectUri

  const authorizeUrl = buildAuthorizationUrl({
    apiHost,
    appKey,
    redirectUri: redirectUriString,
    codeChallenge,
    state,
    nonce,
    scopes: scopes ?? DEFAULT_SCOPES,
    permissions,
    installationId,
  })

  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, redirectUriString)
  if (result.type !== 'success') {
    return { kind: 'cancel' }
  }

  const returnedParams = new URL(result.url).searchParams
  const error = returnedParams.get('error')
  const returnedState = returnedParams.get('state')

  if (error) {
    // The auth page's Cancel button redirects back with error=access_denied
    // (RFC 6749 §4.1.2.1). Treat that as a user-initiated cancel, not a failure.
    // Error/cancel redirects carry no code to exchange, and servers may omit
    // `state` on them (it's only RECOMMENDED per the RFC), so we don't gate
    // these on state — a forged cancel is harmless (it just aborts sign-in).
    // State is still validated below, before any token exchange on success.
    //
    // Note: `access_denied` is also the RFC code for a server-side denial (e.g.
    // revoked app access, suspended account), not just a user tapping Cancel. We
    // deliberately treat all `access_denied` as cancel — the standard OAuth
    // client convention — because there's no reliable signal to distinguish the
    // two and the safe fallback is to abort sign-in cleanly rather than surface
    // an error for what is almost always a user-initiated cancel.
    if (error === 'access_denied') {
      return { kind: 'cancel' }
    }
    throw new Error(
      `Authorization failed: ${error} ${returnedParams.get('error_description') ?? ''}`.trim(),
    )
  }

  if (returnedState !== state) {
    throw new Error('State mismatch - possible CSRF attack')
  }

  const code = await obtainCodeFromCallback({ apiHost, callBackParams: returnedParams })

  const tokens = await exchangeCodeForTokens({
    apiHost,
    appKey,
    code,
    codeVerifier,
    redirectUri: redirectUriString,
  })

  if (!tokens.id_token) {
    throw new Error('Token response missing id_token')
  }
  if (decodeIdToken(tokens.id_token).nonce !== nonce) {
    throw new Error('Nonce mismatch - possible id_token replay')
  }

  return { kind: 'success', tokens, userInfo: deriveUserInfo(tokens.id_token) }
}

async function obtainCodeFromCallback({
  apiHost,
  callBackParams,
}: {
  apiHost: string
  callBackParams: URLSearchParams
}) {
  const url = `https://${apiHost}/auth/callback?${callBackParams}`
  const response = await fetch(url, { method: 'GET', redirect: 'manual' })

  if (response.status !== 302) {
    throw new Error(`auth/callback expected a 302, got ${response.status}`)
  }

  const location = response.headers.get('Location')
  if (!location) {
    throw new Error('auth/callback returned no Location header')
  }

  const locationUrl = new URL(location)
  const code = locationUrl.searchParams.get('code')
  if (!code) {
    throw new Error('Location header had no code param')
  }

  return code
}

function buildAuthorizationUrl(args: {
  apiHost: string
  appKey: string
  redirectUri: string
  codeChallenge: string
  state: string
  nonce: string
  scopes: readonly AuthScope[]
  permissions?: readonly AuthPermission[]
  installationId: string
}): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: args.appKey,
    redirect_uri: args.redirectUri,
    code_challenge: args.codeChallenge,
    code_challenge_method: 'S256',
    state: args.state,
    nonce: args.nonce,
    scope: [...new Set([...args.scopes, 'openid'])].sort().join(' '),
    require_user_interaction: 'true',
    'x-yvp-installation-id': args.installationId,
  })

  // Omit the param entirely when there are none — don't emit an empty one. On the
  // callback, absent `granted_permissions` means "none requested" while an empty
  // value means "requested and denied"; emitting an empty param blurs the two.
  for (const permission of [...new Set(args.permissions ?? [])].sort()) {
    params.append('requested_permissions[]', permission)
  }

  return `https://${args.apiHost}/auth/authorize?${params.toString().replace(/\+/g, '%20')}`
}
