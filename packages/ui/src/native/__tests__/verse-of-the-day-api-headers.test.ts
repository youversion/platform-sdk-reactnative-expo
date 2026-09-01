/**
 * Layer 1 — the native VOTD lookup stamps this SDK's headers (ADR 0012/0020),
 * overriding platform-core's own `X-YVP-Sdk` value.
 */
import { getSdkHeaders } from '../../lib/sdk-version'
import { getVerseOfTheDayPassageId } from '../verse-of-the-day-api'

const credentials = {
  appKey: 'appkey',
  apiHost: 'api.example.com',
  installationId: 'inst-1',
}

describe('getVerseOfTheDayPassageId headers', () => {
  const realFetch = globalThis.fetch
  let fetchMock: jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    fetchMock = jest.fn()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ day: 15, passage_id: 'JHN.3.16' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('sends the request with this SDK\'s stamp and the app credentials', async () => {
    await expect(getVerseOfTheDayPassageId(credentials, 15)).resolves.toBe('JHN.3.16')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain('https://api.example.com/')
    const headers = new Headers(init?.headers)
    expect(headers.get('x-yvp-sdk')).toBe(getSdkHeaders()['X-YVP-Sdk'])
    expect(headers.get('x-yvp-app-key')).toBe('appkey')
    expect(headers.get('x-yvp-installation-id')).toBe('inst-1')
  })
})
