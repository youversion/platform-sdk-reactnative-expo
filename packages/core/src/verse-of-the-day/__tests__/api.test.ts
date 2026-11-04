import pkg from '../../../package.json'
import { createVerseOfTheDayApi } from '../api'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

type VotdRecord = {
  day: number
  passage_id: string
  image_id?: string | null
}

type VotdPage = {
  data: VotdRecord[]
  next_page_token?: string | null
}

type LastRequest = {
  url: URL
  init: RequestInit
}

function jsonResponse(body: VotdRecord | VotdPage | unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: String(status),
    headers: { 'content-type': 'application/json' },
  })
}

function errorResponse(status: number): Response {
  return new Response('', {
    status,
    statusText: String(status),
  })
}

function header(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name)
}

function lastRequest(): LastRequest {
  const call = mockFetch.mock.calls[0]
  if (call === undefined) {
    throw new Error('expected fetch to have been called')
  }
  return { url: new URL(String(call[0])), init: call[1] ?? {} }
}

const api = () =>
  createVerseOfTheDayApi({
    appKey: 'appkey',
    apiHost: 'api.example.com',
    installationId: 'inst-1',
  })

describe('createVerseOfTheDayApi', () => {
  describe('get', () => {
    it('GETs one day with no query when language ranges are omitted', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ day: 15, passage_id: 'JHN.3.16', image_id: 'img-1' }),
      )

      const result = await api().get(15)

      expect(result).toEqual({
        ok: true,
        value: { day: 15, passage_id: 'JHN.3.16', image_id: 'img-1' },
      })
      const { url, init } = lastRequest()
      expect(url.origin + url.pathname).toBe('https://api.example.com/v1/verse-of-the-days/15')
      expect(url.search).toBe('')
      expect(init.method).toBe('GET')
      expect(header(init, 'X-YVP-App-Key')).toBe('appkey')
      expect(header(init, 'X-YVP-Installation-Id')).toBe('inst-1')
      expect(header(init, 'X-YVP-Sdk')).toBe(`ReactNativeSDK=${pkg.version}-dev`)
      expect(header(init, 'Authorization')).toBeNull()
    })

    it.each([
      ['string', { day: 15, passage_id: 'JHN.3.16', image_id: 'img-1' }, 'img-1'],
      ['null', { day: 15, passage_id: 'JHN.3.16', image_id: null }, null],
      ['missing', { day: 15, passage_id: 'JHN.3.16' }, null],
    ] as const)('keeps day and passage when image_id is %s', async (_label, body, imageId) => {
      mockFetch.mockResolvedValue(jsonResponse(body))

      const result = await api().get(15)

      expect(result).toEqual({
        ok: true,
        value: { day: 15, passage_id: 'JHN.3.16', image_id: imageId },
      })
    })

    it('repeats normalized language_ranges[]', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ day: 15, passage_id: 'JHN.3.16' }))

      await api().get(15, { languageRanges: ['en_US', 'pt-BR'] })

      const { url } = lastRequest()
      expect(url.pathname).toBe('/v1/verse-of-the-days/15')
      expect(url.searchParams.getAll('language_ranges[]')).toEqual(['en-us', 'pt-br'])
    })
  })

  describe('list', () => {
    it('GETs the calendar with no query when language ranges are omitted', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          data: [
            { day: 1, passage_id: 'JHN.3.16', image_id: 'img-1' },
            { day: 2, passage_id: 'PSA.23.1', image_id: null },
            { day: 3, passage_id: 'MAT.5.1' },
          ],
          next_page_token: 'year',
        }),
      )

      const result = await api().list()

      expect(result).toEqual({
        ok: true,
        value: {
          data: [
            { day: 1, passage_id: 'JHN.3.16', image_id: 'img-1' },
            { day: 2, passage_id: 'PSA.23.1', image_id: null },
            { day: 3, passage_id: 'MAT.5.1', image_id: null },
          ],
          next_page_token: 'year',
        },
      })
      const { url, init } = lastRequest()
      expect(url.origin + url.pathname).toBe('https://api.example.com/v1/verse-of-the-days')
      expect(url.search).toBe('')
      expect(url.searchParams.has('page_token')).toBe(false)
      expect(header(init, 'Authorization')).toBeNull()
    })

    it('repeats normalized language_ranges[] and does not send a page token', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }))

      await api().list({ languageRanges: ['en_US', '*'] })

      const { url } = lastRequest()
      expect(url.pathname).toBe('/v1/verse-of-the-days')
      expect(url.searchParams.getAll('language_ranges[]')).toEqual(['en-us', '*'])
      expect(url.searchParams.has('page_token')).toBe(false)
    })
  })

  it('maps days outside 1 to 366 and empty language ranges to invalid-parameter without fetching', async () => {
    const rejectedDays = [await api().get(0), await api().get(367)]
    for (const result of rejectedDays) {
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.kind).toBe('invalid-parameter')
      expect(result.error.status).toBeUndefined()
    }

    const emptyGet = await api().get(15, { languageRanges: [] })
    const emptyList = await api().list({ languageRanges: [] })
    for (const result of [emptyGet, emptyList]) {
      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.kind).toBe('invalid-parameter')
      expect(result.error.status).toBeUndefined()
    }

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [404, 'not-found'],
    [400, 'invalid-parameter'],
    [408, 'transient'],
    [429, 'transient'],
    [500, 'transient'],
  ] as const)('maps HTTP %s to %s on get and list', async (status, kind) => {
    const expected = {
      ok: false,
      error: {
        kind,
        status,
        message: `HTTP error! status: ${status}`,
      },
    }

    mockFetch.mockResolvedValue(errorResponse(status))
    await expect(api().get(15)).resolves.toEqual(expected)

    mockFetch.mockResolvedValue(errorResponse(status))
    await expect(api().list()).resolves.toEqual(expected)
  })

  it('maps 204, a malformed day, and a bare array calendar to transient', async () => {
    mockFetch.mockResolvedValue(new Response(null, { status: 204, statusText: 'No Content' }))
    const emptyDay = await api().get(15)
    expect(emptyDay.ok).toBe(false)
    if (emptyDay.ok) return
    expect(emptyDay.error.kind).toBe('transient')
    expect(emptyDay.error.status).toBeUndefined()
    expect(emptyDay.error.message).toMatch(/Unexpected verse-of-the-day API response/)

    mockFetch.mockResolvedValue(jsonResponse({ unexpected: true }))
    const malformed = await api().get(15)
    expect(malformed.ok).toBe(false)
    if (malformed.ok) return
    expect(malformed.error.kind).toBe('transient')
    expect(malformed.error.message).toMatch(/Unexpected verse-of-the-day API response/)

    mockFetch.mockResolvedValue(jsonResponse([{ day: 1, passage_id: 'JHN.3.16' }]))
    const bareArray = await api().list()
    expect(bareArray.ok).toBe(false)
    if (bareArray.ok) return
    expect(bareArray.error.kind).toBe('transient')
    expect(bareArray.error.status).toBeUndefined()
    expect(bareArray.error.message).toMatch(/Unexpected verse-of-the-day API response/)
  })

  it('sends a custom header on the default host and does not add Authorization', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ day: 1, passage_id: 'JHN.3.16' }))

    const client = createVerseOfTheDayApi({
      appKey: 'appkey',
      installationId: 'inst-1',
      additionalHeaders: { 'X-Custom': 'yes' },
    })
    const result = await client.get(1)

    expect(result.ok).toBe(true)
    const { url, init } = lastRequest()
    expect(url.origin + url.pathname).toBe('https://api.youversion.com/v1/verse-of-the-days/1')
    expect(url.search).toBe('')
    expect(header(init, 'X-Custom')).toBe('yes')
    expect(header(init, 'X-YVP-App-Key')).toBe('appkey')
    expect(header(init, 'X-YVP-Installation-Id')).toBe('inst-1')
    expect(header(init, 'X-YVP-Sdk')).toBe(`ReactNativeSDK=${pkg.version}-dev`)
    expect(header(init, 'Authorization')).toBeNull()
  })
})
