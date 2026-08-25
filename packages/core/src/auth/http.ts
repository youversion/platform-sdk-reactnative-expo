import { z } from 'zod'

import { getOrSetInstallationId } from '../installation-id'

export class TokenEndpointError extends Error {
  readonly status: number

  constructor(status: number, body: string) {
    super(`Token endpoint returned ${status}: ${body}`)
    this.name = 'TokenEndpointError'
    this.status = status
  }

  // OAuth2: 400 (invalid_grant) or 401 means the refresh token is dead.
  // Any other status (network throw, 5xx, etc.) is transient — leave tokens alone.
  get isRevoked(): boolean {
    return this.status === 400 || this.status === 401
  }
}

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  id_token: z.string().optional(),
  expires_in: z.string(),
  token_type: z.string(),
  scope: z.string().optional(),
})

export type TokenResponse = z.infer<typeof tokenResponseSchema>

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
  const installationId = getOrSetInstallationId()
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
    throw new TokenEndpointError(response.status, await response.text())
  }

  const parsed = tokenResponseSchema.safeParse(await response.json())
  if (!parsed.success) {
    throw new Error('Token endpoint returned a malformed response')
  }

  return parsed.data
}
