import * as WebBrowser from 'expo-web-browser'
import { fetch as expoFetch } from 'expo/fetch'
import { exchangeCodeForTokens } from '../http'
import { generatePKCEParameters } from '../pkce'
import { signInWithPKCE } from '../pkce-flow'

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}))

jest.mock('expo/fetch', () => ({
  fetch: jest.fn(),
}))

jest.mock('../../installation-id', () => ({
  getOrSetInstallationId: jest.fn(() => Promise.resolve('inst-1')),
}))

jest.mock('../http', () => ({
  exchangeCodeForTokens: jest.fn(),
}))

jest.mock('../pkce', () => ({
  generatePKCEParameters: jest.fn(),
}))

const mockOpenAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock
const mockExpoFetch = expoFetch as jest.Mock
const mockExchange = exchangeCodeForTokens as jest.Mock
const mockGeneratePkce = generatePKCEParameters as jest.Mock

const PKCE_FIXTURE = {
  codeVerifier: 'cv',
  codeChallenge: 'cc',
  nonce: 'NONCE',
  state: 'STATE',
}

function makeJwt(payload: unknown): string {
  const json = JSON.stringify(payload)
  const b64url = Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `aaa.${b64url}.bbb`
}

function defaultProps(overrides: Partial<Parameters<typeof signInWithPKCE>[0]> = {}) {
  return {
    apiHost: 'api.example.com',
    appKey: 'appkey',
    redirectUri: 'https://app/cb',
    ...overrides,
  }
}

function arrangeHappyPath() {
  mockGeneratePkce.mockResolvedValue(PKCE_FIXTURE)
  mockOpenAuthSession.mockResolvedValue({
    type: 'success',
    url: 'https://app/cb?state=STATE',
  })
  mockExpoFetch.mockResolvedValue({
    status: 302,
    headers: { get: jest.fn(() => 'https://app/cb?code=AUTHCODE') },
  })
  mockExchange.mockResolvedValue({
    access_token: 'access',
    refresh_token: 'refresh',
    id_token: makeJwt({ nonce: 'NONCE', sub: 'u1', name: 'Ada' }),
    expires_in: '3600',
    token_type: 'Bearer',
  })
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('signInWithPKCE — cancel', () => {
  it('returns { kind: "cancel" } when the browser session is dismissed', async () => {
    mockGeneratePkce.mockResolvedValue(PKCE_FIXTURE)
    mockOpenAuthSession.mockResolvedValue({ type: 'dismiss' })

    const result = await signInWithPKCE(defaultProps())
    expect(result).toEqual({ kind: 'cancel' })
    expect(mockExpoFetch).not.toHaveBeenCalled()
    expect(mockExchange).not.toHaveBeenCalled()
  })
})

describe('signInWithPKCE — authorization URL', () => {
  it('strips trailing slash from redirectUri, sorts+dedupes scopes (incl. openid), encodes spaces as %20', async () => {
    mockGeneratePkce.mockResolvedValue(PKCE_FIXTURE)
    mockOpenAuthSession.mockResolvedValue({ type: 'dismiss' })

    await signInWithPKCE(
      defaultProps({
        redirectUri: 'https://app/cb/',
        scopes: ['profile', 'email'],
      }),
    )

    const [url, redirectUriArg] = mockOpenAuthSession.mock.calls[0]
    expect(redirectUriArg).toBe('https://app/cb')

    const parsed = new URL(url)
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://app/cb')
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('client_id')).toBe('appkey')
    expect(parsed.searchParams.get('code_challenge')).toBe('cc')
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256')
    expect(parsed.searchParams.get('state')).toBe('STATE')
    expect(parsed.searchParams.get('nonce')).toBe('NONCE')
    expect(parsed.searchParams.get('scope')).toBe('email openid profile')
    expect(parsed.searchParams.get('require_user_interaction')).toBe('true')
    expect(parsed.searchParams.get('x-yvp-installation-id')).toBe('inst-1')
    // Spaces in scope are encoded as %20, not +.
    expect(parsed.search).toContain('scope=email%20openid%20profile')
  })
})

describe('signInWithPKCE — callback error + state CSRF', () => {
  it('returns { kind: "cancel" } when the callback carries error=access_denied (Cancel button)', async () => {
    mockGeneratePkce.mockResolvedValue(PKCE_FIXTURE)
    mockOpenAuthSession.mockResolvedValue({
      type: 'success',
      url: 'https://app/cb?state=STATE&error=access_denied&error_description=User+denied',
    })

    const result = await signInWithPKCE(defaultProps())
    expect(result).toEqual({ kind: 'cancel' })
    expect(mockExpoFetch).not.toHaveBeenCalled()
    expect(mockExchange).not.toHaveBeenCalled()
  })

  it('throws for a non-cancel error param', async () => {
    mockGeneratePkce.mockResolvedValue(PKCE_FIXTURE)
    mockOpenAuthSession.mockResolvedValue({
      type: 'success',
      url: 'https://app/cb?state=STATE&error=server_error&error_description=Boom',
    })
    await expect(signInWithPKCE(defaultProps())).rejects.toThrow(
      'Authorization failed: server_error Boom',
    )
  })

  it('treats access_denied as cancel even when the server omits state', async () => {
    mockGeneratePkce.mockResolvedValue(PKCE_FIXTURE)
    mockOpenAuthSession.mockResolvedValue({
      type: 'success',
      url: 'https://app/cb?error=access_denied',
    })

    const result = await signInWithPKCE(defaultProps())
    expect(result).toEqual({ kind: 'cancel' })
    expect(mockExchange).not.toHaveBeenCalled()
  })

  it('surfaces a non-cancel error even when the server omits state', async () => {
    mockGeneratePkce.mockResolvedValue(PKCE_FIXTURE)
    mockOpenAuthSession.mockResolvedValue({
      type: 'success',
      url: 'https://app/cb?error=server_error&error_description=Boom',
    })
    await expect(signInWithPKCE(defaultProps())).rejects.toThrow(
      'Authorization failed: server_error Boom',
    )
  })

  it('throws on state mismatch (CSRF) and does not proceed to /auth/callback', async () => {
    mockGeneratePkce.mockResolvedValue(PKCE_FIXTURE)
    mockOpenAuthSession.mockResolvedValue({
      type: 'success',
      url: 'https://app/cb?state=WRONG',
    })
    await expect(signInWithPKCE(defaultProps())).rejects.toThrow(
      'State mismatch - possible CSRF attack',
    )
    expect(mockExpoFetch).not.toHaveBeenCalled()
    expect(mockExchange).not.toHaveBeenCalled()
  })
})

describe('signInWithPKCE — obtainCodeFromCallback', () => {
  it('throws when /auth/callback returns a non-302', async () => {
    arrangeHappyPath()
    mockExpoFetch.mockResolvedValue({
      status: 200,
      headers: { get: jest.fn(() => null) },
    })
    await expect(signInWithPKCE(defaultProps())).rejects.toThrow(
      'auth/callback expected a 302, got 200',
    )
  })

  it('throws when /auth/callback returns no Location header', async () => {
    arrangeHappyPath()
    mockExpoFetch.mockResolvedValue({
      status: 302,
      headers: { get: jest.fn(() => null) },
    })
    await expect(signInWithPKCE(defaultProps())).rejects.toThrow(
      'auth/callback returned no Location header',
    )
  })

  it('throws when the Location URL carries no code param', async () => {
    arrangeHappyPath()
    mockExpoFetch.mockResolvedValue({
      status: 302,
      headers: { get: jest.fn(() => 'https://app/cb?state=STATE') },
    })
    await expect(signInWithPKCE(defaultProps())).rejects.toThrow(
      'Location header had no code param',
    )
  })
})

describe('signInWithPKCE — id_token validation', () => {
  it('throws when the token response is missing id_token', async () => {
    arrangeHappyPath()
    mockExchange.mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
      expires_in: '3600',
      token_type: 'Bearer',
    })
    await expect(signInWithPKCE(defaultProps())).rejects.toThrow('Token response missing id_token')
  })

  it('throws on nonce mismatch (id_token replay)', async () => {
    arrangeHappyPath()
    mockExchange.mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
      id_token: makeJwt({ nonce: 'WRONG' }),
      expires_in: '3600',
      token_type: 'Bearer',
    })
    await expect(signInWithPKCE(defaultProps())).rejects.toThrow(
      'Nonce mismatch - possible id_token replay',
    )
  })
})

describe('signInWithPKCE — happy path', () => {
  it('returns { kind: "success", tokens, userInfo } and forwards code+verifier to exchangeCodeForTokens', async () => {
    arrangeHappyPath()
    const result = await signInWithPKCE(defaultProps())

    expect(result).toEqual({
      kind: 'success',
      tokens: expect.objectContaining({
        access_token: 'access',
        refresh_token: 'refresh',
        expires_in: '3600',
        token_type: 'Bearer',
      }),
      userInfo: { id: 'u1', name: 'Ada', email: undefined, avatarUrl: undefined },
    })
    expect(mockExchange).toHaveBeenCalledWith({
      apiHost: 'api.example.com',
      appKey: 'appkey',
      code: 'AUTHCODE',
      codeVerifier: 'cv',
      redirectUri: 'https://app/cb',
    })
  })
})
