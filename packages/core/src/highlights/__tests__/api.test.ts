import * as Crypto from 'expo-crypto'

import { SHIM_UUID, stubCryptoGlobal } from '../../test-utils/crypto-global'
import { createHighlightsApi } from '../api'

const mockFetch = jest.fn()
let mockRandomUUID: jest.SpiedFunction<typeof Crypto.randomUUID>

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
  mockRandomUUID = jest.spyOn(Crypto, 'randomUUID')
  mockRandomUUID.mockClear()
})

afterEach(() => {
  jest.restoreAllMocks()
})

function jsonResponse(body: unknown, status = 200): Response {
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
  createHighlightsApi({
    appKey: 'appkey',
    apiHost: 'api.example.com',
    installationId: 'inst-1',
    additionalHeaders: { 'x-yvp-sdk': 'ReactNativeSDK=1.0.0-dev' },
  })

describe('createHighlightsApi', () => {
  describe('getHighlights', () => {
    it('GETs /v1/highlights with auth and app headers and returns mapped highlights', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          data: [{ bible_id: 111, passage_id: 'JHN.3.16', color: 'fffe00' }],
          next_page_token: null,
        }),
      )

      const result = await api().getHighlights('tok', {
        version_id: 111,
        passage_id: 'JHN.3',
      })

      expect(result).toEqual({
        ok: true,
        value: {
          data: [{ version_id: 111, passage_id: 'JHN.3.16', color: 'fffe00' }],
          next_page_token: null,
        },
      })

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.example.com/v1/highlights?bible_id=111&passage_id=JHN.3')
      expect(init.method).toBe('GET')
      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer tok')
      expect(headers['X-YVP-App-Key']).toBe('appkey')
      expect(headers['X-YVP-Installation-Id']).toBe('inst-1')
      expect(headers['x-yvp-sdk']).toBe('ReactNativeSDK=1.0.0-dev')
    })

    it('returns auth failure for 401 and 403 without throwing', async () => {
      mockFetch.mockResolvedValue(errorResponse(401))

      const unauthorized = await api().getHighlights('tok', {
        version_id: 111,
        passage_id: 'JHN.3',
      })

      expect(unauthorized.ok).toBe(false)
      if (unauthorized.ok) return
      expect(unauthorized.error).toMatchObject({ kind: 'auth', status: 401 })

      mockFetch.mockResolvedValue(errorResponse(403))
      const forbidden = await api().getHighlights('tok', {
        version_id: 111,
        passage_id: 'JHN.3',
      })
      expect(forbidden.ok).toBe(false)
      if (forbidden.ok) return
      expect(forbidden.error).toMatchObject({ kind: 'auth', status: 403 })
    })

    it('returns transient failure for 5xx and network errors', async () => {
      mockFetch.mockResolvedValue(errorResponse(500))
      const serverError = await api().getHighlights('tok', {
        version_id: 111,
        passage_id: 'JHN.3',
      })
      expect(serverError.ok).toBe(false)
      if (serverError.ok) return
      expect(serverError.error).toMatchObject({ kind: 'transient', status: 500 })

      mockFetch.mockRejectedValue(new TypeError('Network request failed'))
      const networkError = await api().getHighlights('tok', {
        version_id: 111,
        passage_id: 'JHN.3',
      })
      expect(networkError.ok).toBe(false)
      if (networkError.ok) return
      expect(networkError.error).toMatchObject({ kind: 'transient' })
      expect(networkError.error.status).toBeUndefined()
    })

    it('returns transient failure when the payload fails schema validation', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [{ wrong_shape: true }] }))

      const result = await api().getHighlights('tok', {
        version_id: 111,
        passage_id: 'JHN.3',
      })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.kind).toBe('transient')
      expect(result.error.message).toMatch(/Unexpected highlights API response/)
    })
  })

  describe('createHighlight', () => {
    it('POSTs a highlight and returns the mapped value', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ bible_id: 111, passage_id: 'JHN.3.16', color: 'fffe00' }),
      )

      const result = await api().createHighlight('tok', {
        version_id: 111,
        passage_id: 'JHN.3.16',
        color: 'FFFE00',
      })

      expect(result).toEqual({
        ok: true,
        value: { version_id: 111, passage_id: 'JHN.3.16', color: 'fffe00' },
      })

      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.example.com/v1/highlights')
      expect(init.method).toBe('POST')
      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer tok')
      expect(headers['X-YVP-App-Key']).toBe('appkey')
      expect(headers['X-YVP-Installation-Id']).toBe('inst-1')
      const body = JSON.parse(init.body as string) as {
        request_id: string
        highlight: { bible_id: number; passage_id: string; color: string }
      }
      expect(body.highlight).toEqual({
        bible_id: 111,
        passage_id: 'JHN.3.16',
        color: 'fffe00',
      })
      // The API requires request_id to be a valid UUID (non-UUIDs 422). The
      // ensure-crypto-uuid shim guarantees crypto.randomUUID exists on RN so
      // platform-core mints a real one rather than its yvp- fallback.
      expect(body.request_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    })

    // The assertion above passes on any runtime that already has
    // crypto.randomUUID — which Node ≥ 19 (and therefore CI) does — so on its own
    // it cannot tell whether createHighlightsApi actually installs the shim.
    // Dropping the global reproduces RN Hermes and pins the wiring: the id must
    // come from expo-crypto, via the shim, on the way into platform-core.
    describe('on a runtime with no crypto global (RN Hermes)', () => {
      let restoreCrypto: () => void

      beforeEach(() => {
        restoreCrypto = stubCryptoGlobal(undefined)
        mockRandomUUID.mockReturnValue(SHIM_UUID)
      })

      afterEach(() => {
        restoreCrypto()
      })

      it('mints request_id from expo-crypto instead of the yvp- fallback', async () => {
        mockFetch.mockResolvedValue(
          jsonResponse({ bible_id: 111, passage_id: 'JHN.3.16', color: 'fffe00' }),
        )

        await api().createHighlight('tok', {
          version_id: 111,
          passage_id: 'JHN.3.16',
          color: 'fffe00',
        })

        const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
        const body = JSON.parse(init.body as string) as { request_id: string }
        expect(body.request_id).toBe(SHIM_UUID)
        expect(mockRandomUUID).toHaveBeenCalled()
      })
    })

    it('returns auth failure for 401 without throwing', async () => {
      mockFetch.mockResolvedValue(errorResponse(401))

      const result = await api().createHighlight('tok', {
        version_id: 111,
        passage_id: 'JHN.3.16',
        color: 'fffe00',
      })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toMatchObject({ kind: 'auth', status: 401 })
    })

    it('returns transient failure for 5xx and network errors', async () => {
      mockFetch.mockResolvedValue(errorResponse(500))
      const serverError = await api().createHighlight('tok', {
        version_id: 111,
        passage_id: 'JHN.3.16',
        color: 'fffe00',
      })
      expect(serverError.ok).toBe(false)
      if (serverError.ok) return
      expect(serverError.error).toMatchObject({ kind: 'transient', status: 500 })

      mockFetch.mockRejectedValue(new TypeError('Network request failed'))
      const networkError = await api().createHighlight('tok', {
        version_id: 111,
        passage_id: 'JHN.3.16',
        color: 'fffe00',
      })
      expect(networkError.ok).toBe(false)
      if (networkError.ok) return
      expect(networkError.error).toMatchObject({ kind: 'transient' })
      expect(networkError.error.status).toBeUndefined()
    })
  })

  describe('deleteHighlight', () => {
    it('DELETEs by passage and returns void on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: { get: () => null },
        json: () => Promise.resolve(null),
        text: () => Promise.resolve(''),
      } as unknown as Response)

      const result = await api().deleteHighlight('tok', 'JHN.3.16', { version_id: 111 })

      expect(result).toEqual({ ok: true, value: undefined })
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('https://api.example.com/v1/highlights/JHN.3.16?bible_id=111')
      expect(init.method).toBe('DELETE')
      const headers = init.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer tok')
      expect(headers['X-YVP-App-Key']).toBe('appkey')
      expect(headers['X-YVP-Installation-Id']).toBe('inst-1')
    })

    it('returns auth failure for 403', async () => {
      mockFetch.mockResolvedValue(errorResponse(403))

      const result = await api().deleteHighlight('tok', 'JHN.3.16', { version_id: 111 })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toMatchObject({ kind: 'auth', status: 403 })
    })

    it('returns transient failure for 5xx', async () => {
      mockFetch.mockResolvedValue(errorResponse(500))

      const result = await api().deleteHighlight('tok', 'JHN.3.16', { version_id: 111 })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toMatchObject({ kind: 'transient', status: 500 })
    })
  })
})
