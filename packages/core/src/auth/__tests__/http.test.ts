import { exchangeCodeForTokens, refreshTokens, type TokenResponse } from '../http'

jest.mock('../../installation-id', () => ({
  getOrSetInstallationId: jest.fn(() => Promise.resolve('inst-1')),
}))

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
})

const okTokens: TokenResponse = {
  access_token: 'a',
  refresh_token: 'r',
  id_token: 'i',
  expires_in: '3600',
  token_type: 'Bearer',
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response
}

function errorResponse(status: number, body: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(null),
    text: () => Promise.resolve(body),
  } as Response
}

describe('exchangeCodeForTokens', () => {
  it('POSTs the authorization_code grant to /auth/token and returns the parsed body', async () => {
    mockFetch.mockResolvedValue(okResponse(okTokens))

    const result = await exchangeCodeForTokens({
      apiHost: 'api.example.com',
      appKey: 'appkey',
      code: 'authcode',
      codeVerifier: 'verifier',
      redirectUri: 'https://app/cb',
    })

    expect(result).toEqual(okTokens)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.example.com/auth/token')
    expect(init.method).toBe('POST')

    const headers = init.headers as Headers
    expect(headers.get('Content-Type')).toBe('application/x-www-form-urlencoded')
    expect(headers.get('X-YVP-App-Key')).toBe('appkey')
    expect(headers.get('X-YVP-Installation-Id')).toBe('inst-1')

    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('authcode')
    expect(body.get('redirect_uri')).toBe('https://app/cb')
    expect(body.get('client_id')).toBe('appkey')
    expect(body.get('code_verifier')).toBe('verifier')
  })
})

describe('refreshTokens', () => {
  it('POSTs the refresh_token grant with the refresh token and client_id', async () => {
    mockFetch.mockResolvedValue(okResponse(okTokens))

    const result = await refreshTokens({
      apiHost: 'api.example.com',
      appKey: 'appkey',
      refreshToken: 'rt',
    })

    expect(result).toEqual(okTokens)
    const init = mockFetch.mock.calls[0][1]
    const body = new URLSearchParams(init.body as string)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('rt')
    expect(body.get('client_id')).toBe('appkey')
  })
})

describe('error paths (via exchangeCodeForTokens)', () => {
  const callExchange = () =>
    exchangeCodeForTokens({
      apiHost: 'api.example.com',
      appKey: 'appkey',
      code: 'authcode',
      codeVerifier: 'verifier',
      redirectUri: 'https://app/cb',
    })

  it('throws with status and response body when the response is not OK', async () => {
    mockFetch.mockResolvedValue(errorResponse(400, 'bad request body'))
    await expect(callExchange()).rejects.toThrow('Token endpoint returned 400: bad request body')
  })

  it.each<[string, unknown]>([
    ['missing access_token', { refresh_token: 'r', expires_in: '1', token_type: 'Bearer' }],
    ['missing refresh_token', { access_token: 'a', expires_in: '1', token_type: 'Bearer' }],
    ['missing expires_in', { access_token: 'a', refresh_token: 'r', token_type: 'Bearer' }],
    ['missing token_type', { access_token: 'a', refresh_token: 'r', expires_in: '1' }],
    // Pins commit e69a44b: the backend returns expires_in as a string, not a number.
    ['expires_in as number', { ...okTokens, expires_in: 3600 }],
    ['a non-object body', 'just a string'],
    ['null', null],
  ])('throws "malformed response" when the body is %s', async (_label, body) => {
    mockFetch.mockResolvedValue(okResponse(body))
    await expect(callExchange()).rejects.toThrow('Token endpoint returned a malformed response')
  })
})
