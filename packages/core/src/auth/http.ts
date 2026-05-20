import { getOrSetInstallationId } from '../installation-id'

export type TokenResponse = {
  access_token: string
  refresh_token: string
  id_token?: string
  expires_in: number
  token_type: string
  scope?: string
}

export async function exchangeCodeForTokens(args: {
  apiHost: string
  appKey: string
  code: string
  codeVerifier: string
  redirectUri: string
}): Promise<TokenResponse> {
  return postTokenEndpoint(args.apiHost, args.appKey, {
    grant_type: 'authorization_code',
    code: args.code,
    redirect_uri: args.redirectUri,
    client_id: args.appKey,
    code_verifier: args.codeVerifier,
  })
}

export async function refreshTokens(args: {
  apiHost: string
  appKey: string
  refreshToken: string
}): Promise<TokenResponse> {
  return postTokenEndpoint(args.apiHost, args.appKey, {
    grant_type: 'refresh_token',
    refresh_token: args.refreshToken,
    client_id: args.appKey,
  })
}

async function postTokenEndpoint(
  apiHost: string,
  appKey: string,
  body: Record<string, string>,
): Promise<TokenResponse> {
  const installationId = await getOrSetInstallationId()
  const headers = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-YVP-App-Key': appKey,
    'X-YVP-Installation-Id': installationId,
  })

  const response = await fetch(`https://${apiHost}/auth/token`, {
    method: 'POST',
    body: new URLSearchParams(body).toString(),
    headers: headers,
  })

  if (!response.ok) {
    throw new Error(`Token endpoint returned ${response.status}: ${await response.text()}`)
  }

  const data: unknown = await response.json()
  if (!isTokenResponse(data)) {
    throw new Error('Token endpoint returned a malformed response')
  }

  return data
}

function isTokenResponse(response: unknown): response is TokenResponse {
  if (typeof response !== 'object' || response === null) {
    return false
  }
  const object = response as Record<string, unknown>
  return (
    typeof object.access_token === 'string' &&
    object.refresh_token === 'string' &&
    object.expires_in === 'number' &&
    object.token_type === 'string'
  )
}
