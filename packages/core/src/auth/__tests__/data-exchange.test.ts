import * as WebBrowser from 'expo-web-browser'

import { requestPermissionViaDataExchange } from '../data-exchange'

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}))

jest.mock('../../installation-id', () => ({
  getOrSetInstallationId: jest.fn(() => Promise.resolve('inst-1')),
}))

const mockOpenAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock
const mockFetch = jest.fn()

function jsonResponse(body: unknown, status = 201): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: (name: string) => (name === 'content-type' ? 'application/json' : null) },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    statusText: String(status),
    headers: { get: () => null },
    json: () => Promise.resolve(null),
    text: () => Promise.resolve(''),
  } as unknown as Response
}

const REDIRECT_URI = 'com.example.app://callback'

function props(overrides: Partial<Parameters<typeof requestPermissionViaDataExchange>[0]> = {}) {
  return {
    apiHost: 'api.example.com',
    appKey: 'appkey',
    accessToken: 'access-token',
    redirectUri: REDIRECT_URI,
    permissions: ['highlights'] as const,
    initiatorUserId: 'user-1',
    getCurrentUserId: () => 'user-1',
    ...overrides,
  }
}

/** The hosted consent page returns to the app redirect with its verdict appended. */
function returnedFrom(search: string) {
  return { type: 'success', url: `${REDIRECT_URI}?${search}` }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockFetch.mockReset()
  mockFetch.mockResolvedValue(jsonResponse({ token: 'dx-token' }))
  global.fetch = mockFetch as unknown as typeof fetch
})

describe('requestPermissionViaDataExchange', () => {
  it('mints a token, opens the hosted consent page, and returns the grant', async () => {
    mockOpenAuthSession.mockResolvedValue(
      returnedFrom('data_exchange_status=granted&granted_permissions[]=highlights'),
    )

    const result = await requestPermissionViaDataExchange(props())

    expect(result).toEqual({ kind: 'granted', permissions: ['highlights'] })

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.com/data-exchange/token?app-key=appkey')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ requested_permissions: ['highlights'] })
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer access-token')
    expect(headers['X-YVP-Installation-Id']).toBe('inst-1')

    expect(mockOpenAuthSession).toHaveBeenCalledWith(
      'https://api.example.com/data-exchange?token=dx-token&app_key=appkey&x-yvp-app-key=appkey',
      REDIRECT_URI,
    )
  })

  it('strips a trailing slash from the redirect so the session matches the return URL', async () => {
    mockOpenAuthSession.mockResolvedValue(returnedFrom('data_exchange_status=cancel'))

    await requestPermissionViaDataExchange(props({ redirectUri: `${REDIRECT_URI}/` }))

    expect(mockOpenAuthSession).toHaveBeenCalledWith(expect.any(String), REDIRECT_URI)
  })

  it('returns the permissions the server actually granted, not the ones we asked for', async () => {
    mockOpenAuthSession.mockResolvedValue(
      returnedFrom('data_exchange_status=granted&granted_permissions[]=votd'),
    )

    const result = await requestPermissionViaDataExchange(props())

    // `granted` means the exchange completed. The caller still has to check
    // whether what it asked for is in there.
    expect(result).toEqual({ kind: 'granted', permissions: ['votd'] })
  })

  it('reports a granted return that names nothing as an empty grant', async () => {
    mockOpenAuthSession.mockResolvedValue(returnedFrom('data_exchange_status=granted'))

    await expect(requestPermissionViaDataExchange(props())).resolves.toEqual({
      kind: 'granted',
      permissions: [],
    })
  })

  describe('fails closed when the signed-in user changes mid-flow', () => {
    it('discards a grant that returns to a different user', async () => {
      mockOpenAuthSession.mockResolvedValue(
        returnedFrom('data_exchange_status=granted&granted_permissions[]=highlights'),
      )

      const result = await requestPermissionViaDataExchange(
        props({ getCurrentUserId: () => 'user-2' }),
      )

      expect(result).toEqual({ kind: 'failure', message: expect.stringMatching(/discarded/) })
    })

    it('discards a grant that returns with nobody signed in', async () => {
      mockOpenAuthSession.mockResolvedValue(
        returnedFrom('data_exchange_status=granted&granted_permissions[]=highlights'),
      )

      const result = await requestPermissionViaDataExchange(props({ getCurrentUserId: () => null }))

      expect(result.kind).toBe('failure')
    })

    it('discards a grant we cannot attribute to an initiator', async () => {
      mockOpenAuthSession.mockResolvedValue(
        returnedFrom('data_exchange_status=granted&granted_permissions[]=highlights'),
      )

      const result = await requestPermissionViaDataExchange(props({ initiatorUserId: null }))

      expect(result.kind).toBe('failure')
    })
  })

  describe('cancels', () => {
    it('when the user dismisses the browser', async () => {
      mockOpenAuthSession.mockResolvedValue({ type: 'dismiss' })

      await expect(requestPermissionViaDataExchange(props())).resolves.toEqual({ kind: 'cancel' })
    })

    it('when the consent page returns data_exchange_status=cancel', async () => {
      mockOpenAuthSession.mockResolvedValue(returnedFrom('data_exchange_status=cancel'))

      await expect(requestPermissionViaDataExchange(props())).resolves.toEqual({ kind: 'cancel' })
    })
  })

  describe('fails', () => {
    it('when the token mint is rejected', async () => {
      mockFetch.mockResolvedValue(errorResponse(401))

      const result = await requestPermissionViaDataExchange(props())

      expect(result).toEqual({ kind: 'failure', message: expect.stringContaining('401') })
      expect(mockOpenAuthSession).not.toHaveBeenCalled()
    })

    it('when the token response has no token', async () => {
      mockFetch.mockResolvedValue(jsonResponse({}))

      expect((await requestPermissionViaDataExchange(props())).kind).toBe('failure')
      expect(mockOpenAuthSession).not.toHaveBeenCalled()
    })

    it('when opening the browser session throws', async () => {
      mockOpenAuthSession.mockRejectedValue(new Error('no browser'))

      await expect(requestPermissionViaDataExchange(props())).resolves.toEqual({
        kind: 'failure',
        message: 'no browser',
      })
    })

    it('when something non-Error is thrown', async () => {
      mockOpenAuthSession.mockRejectedValue('just a string')

      await expect(requestPermissionViaDataExchange(props())).resolves.toEqual({
        kind: 'failure',
        message: 'just a string',
      })
    })

    it('when the return URL carries no data-exchange status', async () => {
      mockOpenAuthSession.mockResolvedValue(returnedFrom('foo=bar'))

      expect((await requestPermissionViaDataExchange(props())).kind).toBe('failure')
    })

    it('when the consent page reports a failure', async () => {
      mockOpenAuthSession.mockResolvedValue(returnedFrom('data_exchange_status=whatever'))

      expect((await requestPermissionViaDataExchange(props())).kind).toBe('failure')
    })

    it('when the return URL is unparseable', async () => {
      mockOpenAuthSession.mockResolvedValue({ type: 'success', url: 'not a url at all' })

      expect((await requestPermissionViaDataExchange(props())).kind).toBe('failure')
    })
  })

  it('reads the query off a custom-scheme return URL that URL cannot parse', async () => {
    mockOpenAuthSession.mockResolvedValue({
      type: 'success',
      url: 'not a url?data_exchange_status=granted&granted_permissions=highlights',
    })

    await expect(requestPermissionViaDataExchange(props())).resolves.toEqual({
      kind: 'granted',
      permissions: ['highlights'],
    })
  })
})
