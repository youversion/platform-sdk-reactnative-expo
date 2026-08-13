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
  getOrSetInstallationId: jest.fn(() => 'inst-1'),
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

function arrangeHappyPath(redirectQuery = 'state=STATE') {
  mockGeneratePkce.mockResolvedValue(PKCE_FIXTURE)
  mockOpenAuthSession.mockResolvedValue({
    type: 'success',
    url: `https://app/cb?${redirectQuery}`,
  })
  // The /auth/callback hop deliberately carries no granted_permissions: on device
  // its Location header drops them, so a test that read the grant from here would
  // pass while the real flow reported "unknown".
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

describe('signInWithPKCE — requested permissions', () => {
  async function authorizeParams(
    overrides: Partial<Parameters<typeof signInWithPKCE>[0]> = {},
  ): Promise<URLSearchParams> {
    mockGeneratePkce.mockResolvedValue(PKCE_FIXTURE)
    mockOpenAuthSession.mockResolvedValue({ type: 'dismiss' })

    await signInWithPKCE(defaultProps(overrides))

    const [url] = mockOpenAuthSession.mock.calls[0]
    return new URL(url).searchParams
  }

  it('appends a requested_permissions[] param per configured permission', async () => {
    const params = await authorizeParams({ permissions: ['highlights', 'bibles'] })
    expect(params.getAll('requested_permissions[]')).toEqual(['bibles', 'highlights'])
  })

  it('omits requested_permissions[] when permissions are not configured', async () => {
    const params = await authorizeParams()
    expect(params.getAll('requested_permissions[]')).toEqual([])
    expect(params.has('requested_permissions[]')).toBe(false)
  })

  it('omits requested_permissions[] when permissions is an empty array', async () => {
    const params = await authorizeParams({ permissions: [] })
    expect(params.getAll('requested_permissions[]')).toEqual([])
    expect(params.has('requested_permissions[]')).toBe(false)
  })

  it('dedupes and sorts requested permissions', async () => {
    const params = await authorizeParams({
      permissions: ['votd', 'highlights', 'votd', 'bible_activity'],
    })
    expect(params.getAll('requested_permissions[]')).toEqual([
      'bible_activity',
      'highlights',
      'votd',
    ])
  })

  it('never leaks a permission value into the scope param', async () => {
    const params = await authorizeParams({
      scopes: ['profile', 'email'],
      permissions: ['highlights', 'bibles', 'votd', 'demographics', 'bible_activity'],
    })
    expect(params.get('scope')).toBe('email openid profile')
    for (const permission of ['highlights', 'bibles', 'votd', 'demographics', 'bible_activity']) {
      expect(params.get('scope')).not.toContain(permission)
    }
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
      url: 'https://app/cb?state=STATE&error=server_error&error_description=Service+unavailable',
    })
    await expect(signInWithPKCE(defaultProps())).rejects.toThrow(
      'Authorization failed: server_error Service unavailable',
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
      url: 'https://app/cb?error=server_error&error_description=Service+unavailable',
    })
    await expect(signInWithPKCE(defaultProps())).rejects.toThrow(
      'Authorization failed: server_error Service unavailable',
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

  it('throws when the id_token has no string sub claim', async () => {
    arrangeHappyPath()
    mockExchange.mockResolvedValue({
      access_token: 'a',
      refresh_token: 'r',
      id_token: makeJwt({ nonce: 'NONCE', sub: 123 }),
      expires_in: '3600',
      token_type: 'Bearer',
    })
    await expect(signInWithPKCE(defaultProps())).rejects.toThrow('id_token missing sub claim')
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
      grantedPermissions: null,
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

describe('signInWithPKCE — granted permissions read-back', () => {
  async function grantFrom(redirectQuery: string) {
    arrangeHappyPath(redirectQuery)
    const result = await signInWithPKCE(defaultProps())
    if (result.kind !== 'success') {
      throw new Error('expected a successful sign-in')
    }
    return result.grantedPermissions
  }

  it('reads the grant from the app redirect even though the /auth/callback hop drops it', async () => {
    // arrangeHappyPath's Location header carries only `code` — no
    // granted_permissions. If parsing moved after obtainCodeFromCallback, this
    // would read null.
    const granted = await grantFrom('state=STATE&granted_permissions[]=highlights')

    expect(granted).toEqual(['highlights'])
    // Guard the premise: the callback hop really did omit the param.
    const callbackResponse = await mockExpoFetch.mock.results[0]?.value
    expect(callbackResponse.headers.get('Location')).not.toContain('granted_permissions')
  })

  it('reads multiple granted permissions', async () => {
    const granted = await grantFrom(
      'state=STATE&granted_permissions[]=highlights&granted_permissions[]=bibles',
    )
    expect(granted).toEqual(['highlights', 'bibles'])
  })

  it('reports null when the redirect carries no granted_permissions param', async () => {
    expect(await grantFrom('state=STATE')).toBeNull()
  })

  it('reports [] — requested and denied — when the param is present but empty', async () => {
    expect(await grantFrom('state=STATE&granted_permissions[]=')).toEqual([])
  })
})
