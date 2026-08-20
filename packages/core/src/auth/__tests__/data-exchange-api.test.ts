import { DataExchangeClient } from '@youversion/platform-core'

import { createDataExchangeApi } from '../data-exchange-api'

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
})

function header(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name)
}

function jsonResponse(body: unknown, status = 201): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: (name: string) => (name === 'content-type' ? 'application/json' : null) },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
}

function errorResponse(status: number, body = ''): Response {
  return {
    ok: false,
    status,
    statusText: String(status),
    headers: { get: () => null },
    json: () => Promise.resolve(null),
    text: () => Promise.resolve(body),
  } as unknown as Response
}

const api = () =>
  createDataExchangeApi({
    appKey: 'appkey',
    apiHost: 'api.example.com',
    installationId: 'inst-1',
  })

describe('createDataExchangeApi — mintToken', () => {
  it('POSTs the requested permissions to /data-exchange/token and returns the minted token', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ token: 'dx-token' }))

    const result = await api().mintToken('tok', ['highlights'])

    expect(result).toEqual({ ok: true, value: 'dx-token' })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.example.com/data-exchange/token?app-key=appkey')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ requested_permissions: ['highlights'] })
    expect(header(init, 'Authorization')).toBe('Bearer tok')
    expect(header(init, 'X-YVP-App-Key')).toBe('appkey')
    expect(header(init, 'X-YVP-Installation-Id')).toBe('inst-1')
  })

  it('falls back to the default API host when none is configured', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ token: 'dx-token' }))

    await createDataExchangeApi({ appKey: 'appkey', installationId: 'inst-1' }).mintToken('tok', [
      'highlights',
    ])

    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toBe('https://api.youversion.com/data-exchange/token?app-key=appkey')
  })

  // The token must travel as the explicit `lat` argument. Omitted, platform-core
  // resolves it from the ambient browser configuration, which is not this
  // provider's token — the same rule createHighlightsApi follows.
  it('passes the access token to the client as an explicit lat argument', async () => {
    const updateToken = jest
      .spyOn(DataExchangeClient.prototype, 'updateToken')
      .mockResolvedValue('dx-token')

    try {
      await api().mintToken('tok', ['highlights', 'votd'])
      expect(updateToken).toHaveBeenCalledWith(['highlights', 'votd'], 'tok')
    } finally {
      updateToken.mockRestore()
    }
  })

  it('reports a 401 as not-permitted rather than a generic failure', async () => {
    mockFetch.mockResolvedValue(errorResponse(401))

    const result = await api().mintToken('tok', ['highlights'])

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('not-permitted')
    expect(result.error.message).toBeTruthy()
  })

  it('reports 5xx and network errors as transient', async () => {
    mockFetch.mockResolvedValue(errorResponse(500))
    const serverError = await api().mintToken('tok', ['highlights'])
    expect(serverError.ok).toBe(false)
    if (serverError.ok) return
    expect(serverError.error).toMatchObject({ kind: 'transient', status: 500 })

    mockFetch.mockRejectedValue(new TypeError('Network request failed'))
    const networkError = await api().mintToken('tok', ['highlights'])
    expect(networkError.ok).toBe(false)
    if (networkError.ok || networkError.error.kind !== 'transient') {
      throw new Error('expected a transient failure')
    }
    expect(networkError.error.status).toBeUndefined()
  })

  it('reports a malformed 2xx payload as transient', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ not_a_token: true }))

    const result = await api().mintToken('tok', ['highlights'])

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('transient')
    expect(result.error.message).toMatch(/Unexpected data exchange token response/)
  })

  it('reports a non-Error throw as transient without stringifying to [object Object]', async () => {
    const updateToken = jest
      .spyOn(DataExchangeClient.prototype, 'updateToken')
      .mockRejectedValue('boom')

    try {
      const result = await api().mintToken('tok', ['highlights'])
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toEqual({ kind: 'transient', message: 'boom' })
    } finally {
      updateToken.mockRestore()
    }
  })
})
