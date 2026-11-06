import pkg from '../../package.json'
import { createDataExchangeApi } from '../auth/data-exchange-api'
import { createHighlightsApi } from '../highlights/api'
import { createImagesApi } from '../images/api'
import type { Result } from '../result'
import { createSearchApi } from '../search/api'
import { createVerseOfTheDayApi } from '../verse-of-the-day/api'

type Credentials = {
  appKey: string
  installationId: string
  apiHost?: string
  timeout?: number
}

type CredentialsWithHeaders = Credentials & { additionalHeaders?: Record<string, string> }

type ApiOutcome = Result<object | string, { kind: string; message: string }>

type CapturedRequest = {
  url: URL
  headers: Headers
}

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockRejectedValue(new Error('offline'))
  global.fetch = mockFetch
})

function firstRequest(): CapturedRequest {
  const call = mockFetch.mock.calls[0]
  if (call === undefined) {
    throw new Error('expected fetch to have been called')
  }
  return { url: new URL(String(call[0])), headers: new Headers(call[1]?.headers) }
}

function hangUntilAborted(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    })
  })
}

const sitesWithHeaders: ReadonlyArray<
  [string, (config: CredentialsWithHeaders) => Promise<ApiOutcome>]
> = [
  ['search', (config) => createSearchApi(config).trendingQueries({ languageRanges: ['en'] })],
  ['images', (config) => createImagesApi(config).list()],
  ['verse of the day', (config) => createVerseOfTheDayApi(config).get(1)],
  [
    'highlights',
    (config) =>
      createHighlightsApi(config).getHighlights('tok', { version_id: 111, passage_id: 'JHN.3' }),
  ],
]

const sites: ReadonlyArray<[string, (config: Credentials) => Promise<ApiOutcome>]> = [
  ...sitesWithHeaders,
  ['data exchange', (config) => createDataExchangeApi(config).mintToken('tok', ['highlights'])],
]

const credentials = { appKey: 'appkey', installationId: 'inst-1' }

describe.each(sites)('%s ApiClient requests', (_name, send) => {
  it('send the app key, installation id, and this SDK stamp', async () => {
    await send({ ...credentials, apiHost: 'api.example.com' })

    const { url, headers } = firstRequest()
    expect(url.host).toBe('api.example.com')
    expect(headers.get('X-YVP-App-Key')).toBe('appkey')
    expect(headers.get('X-YVP-Installation-Id')).toBe('inst-1')
    expect(headers.get('X-YVP-Sdk')).toBe(`ReactNativeSDK=${pkg.version}-dev`)
  })

  it('go to api.youversion.com when no host is configured', async () => {
    await send(credentials)

    expect(firstRequest().url.host).toBe('api.youversion.com')
  })

  it('go to api.youversion.com when the host is an empty string', async () => {
    await send({ ...credentials, apiHost: '' })

    expect(firstRequest().url.host).toBe('api.youversion.com')
  })

  it('time out at the configured timeout', async () => {
    mockFetch.mockImplementation(hangUntilAborted)

    await expect(send({ ...credentials, timeout: 20 })).resolves.toEqual({
      ok: false,
      error: { kind: 'transient', message: 'Request timeout after 20ms' },
    })
  })
})

describe.each(sitesWithHeaders)('%s ApiClient additional headers', (_name, send) => {
  it('keep consumer headers but never a consumer SDK stamp', async () => {
    await send({
      ...credentials,
      additionalHeaders: { 'X-Custom': 'yes', 'x-yvp-sdk': 'consumer-stamp' },
    })

    const { headers } = firstRequest()
    expect(headers.get('X-Custom')).toBe('yes')
    expect(headers.get('X-YVP-Sdk')).toBe(`ReactNativeSDK=${pkg.version}-dev`)
  })
})
