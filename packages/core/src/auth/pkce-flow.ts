import * as WebBrowser from 'expo-web-browser'
import { getOrSetInstallationId } from '../installation-id'
import { DEFAULT_SCOPES } from './constants'
import { exchangeCodeForTokens, type TokenResponse } from './http'
import { generatePKCEParameters } from './pkce'
import type { AuthScope } from './types'

export type SignInResult =
  | {
      kind: 'success'
      tokens: TokenResponse
    }
  | { kind: 'cancel' }

type SignInWithPKCEProps = {
  apiHost: string
  appKey: string
  redirectUri: string
  scopes?: readonly AuthScope[]
}

export async function signInWithPKCE({
  apiHost,
  appKey,
  redirectUri,
  scopes,
}: SignInWithPKCEProps): Promise<SignInResult> {
  const { codeVerifier, codeChallenge, nonce, state } = await generatePKCEParameters()
  const installationId = await getOrSetInstallationId()
  const redirectUriString = redirectUri.endsWith('/') ? redirectUri.slice(0, -1) : redirectUri

  const authorizeUrl = buildAuthorizationUrl({
    apiHost,
    appKey,
    redirectUri: redirectUriString,
    codeChallenge,
    state,
    nonce,
    scopes: scopes ?? DEFAULT_SCOPES,
    installationId,
  })
  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, redirectUriString)

  if (result.type !== 'success') {
    return { kind: 'cancel' }
  }

  const returnedParams = new URL(result.url).searchParams
  const error = returnedParams.get('error')
  const returnedState = returnedParams.get('state')
  const code = returnedParams.get('code')

  if (error) {
    throw new Error(
      `Authorization failed: ${error} ${returnedParams.get('error_description') ?? ''}`.trim(),
    )
  }

  if (returnedState !== state) {
    throw new Error('State mismatch - possible CSRF attack')
  }

  if (!code) {
    throw new Error('Authorization returned no code')
  }

  const tokens = await exchangeCodeForTokens({
    apiHost,
    appKey,
    code,
    codeVerifier,
    redirectUri: redirectUriString,
  })

  return { kind: 'success', tokens }
}
function buildAuthorizationUrl(args: {
  apiHost: string
  appKey: string
  redirectUri: string
  codeChallenge: string
  state: string
  nonce: string
  scopes: readonly AuthScope[]
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
    scope: ['openid', ...args.scopes].join(' '),
    'x-yvp-installation-id': args.installationId,
  })

  return `https://${args.apiHost}/auth/authorize?${params.toString()}`
}
