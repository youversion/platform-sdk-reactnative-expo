import * as installationId from '../../installation-id'
import { exchangeCodeForTokens, refreshTokens, type TokenResponse } from '../http'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
  jest.spyOn(installationId, 'getOrSetInstallationId').mockReturnValue('inst-1')
})

afterEach(() => {
  jest.restoreAllMocks()
})

const okTokens: TokenResponse = {
  access_token: 'a',
  refresh_token: 'r',
  id_token: 'i',
  expires_in: '3600',
  token_type: 'Bearer',
}

type MalformedTokenBody =
  | { refresh_token: string; expires_in: string; token_type: string }
  | { access_token: string; expires_in: string; token_type: string }
  | { access_token: string; refresh_token: string; token_type: string }
  | { access_token: string; refresh_token: string; expires_in: string }
  | (Omit<TokenResponse, 'expires_in'> & { expires_in: number })
  | string
  | null

function okResponse(body: TokenResponse | MalformedTokenBody): Response {
  return new Response(JSON.stringify(body), { status: 200 })
}

function errorResponse(status: number, body: string): Response {
  return new Response(body, { status })
}

function requestBodyText(body: BodyInit | null | undefined): string {
  if (body === undefined || body === null) return ''
  if (body instanceof URLSearchParams) return body.toString()
  if (body instanceof FormData) return ''
  if (body instanceof Blob) return ''
  if (body instanceof ArrayBuffer) return ''
  if (ArrayBuffer.isView(body)) return ''
  if (body instanceof ReadableStream) return ''
  return body
}

function lastInit(): RequestInit {
  const call = mockFetch.mock.calls[0]
  expect(call).toBeDefined()
  return call[1] ?? {}
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
    expect(init?.method).toBe('POST')

    const headers = new Headers(init?.headers)
    expect(headers.get('Content-Type')).toBe('application/x-www-form-urlencoded')
    expect(headers.get('X-YVP-App-Key')).toBe('appkey')
    expect(headers.get('X-YVP-Installation-Id')).toBe('inst-1')

    const body = new URLSearchParams(requestBodyText(init?.body))
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
    const init = lastInit()
    const body = new URLSearchParams(requestBodyText(init.body))
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

  it.each<[string, MalformedTokenBody]>([
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
