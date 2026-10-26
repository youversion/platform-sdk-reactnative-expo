import { createImagesApi } from '../api'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

type ImageRecord = {
  id: string
  image_url: string
  passage_id: string
  attribution: string
  language_tag: string
  width: number
  height: number
  aspect_ratio: number
}

type ImagesPageJson = {
  data: ImageRecord[]
  next_page_token?: string | null
  total_size?: number | null
}

type LastRequest = {
  url: URL
  init: RequestInit
}

const SAMPLE_IMAGE: ImageRecord = {
  id: 'img-1',
  image_url: 'https://cdn.example.com/img-1.jpg',
  passage_id: 'JHN.3.16',
  attribution: 'YouVersion',
  language_tag: 'en-US',
  width: 1200,
  height: 800,
  aspect_ratio: 1.5,
}

function jsonResponse(body: ImagesPageJson | ImageRecord, status = 200): Response {
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

function lastRequest(): LastRequest {
  const call = mockFetch.mock.calls[0]
  if (call === undefined) {
    throw new Error('expected fetch to have been called')
  }
  return { url: new URL(String(call[0])), init: call[1] ?? {} }
}

const api = () =>
  createImagesApi({
    appKey: 'appkey',
    apiHost: 'api.example.com',
    installationId: 'inst-1',
  })

describe('createImagesApi', () => {
  describe('list', () => {
    it('GETs /v1/images with passage_id and normalized language_ranges[]', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          data: [SAMPLE_IMAGE],
          next_page_token: 'next',
          total_size: 1,
        }),
      )

      const result = await api().list({
        passage_id: 'JHN.3.16',
        language_ranges: ['en-US', 'pt_BR'],
      })

      expect(result).toEqual({
        ok: true,
        value: {
          data: [SAMPLE_IMAGE],
          next_page_token: 'next',
          total_size: 1,
        },
      })

      const { url, init } = lastRequest()
      expect(url.origin + url.pathname).toBe('https://api.example.com/v1/images')
      expect(url.searchParams.get('passage_id')).toBe('JHN.3.16')
      expect(url.searchParams.getAll('language_ranges[]')).toEqual(['en-us', 'pt-br'])
      expect(init.method).toBe('GET')
      expect(new Headers(init.headers).get('X-YVP-App-Key')).toBe('appkey')
      expect(new Headers(init.headers).get('X-YVP-Installation-Id')).toBe('inst-1')
    })

    it('returns an empty page when data is an empty array', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }))

      const result = await api().list({ passage_id: 'JHN.3.16' })

      expect(result).toEqual({
        ok: true,
        value: { data: [], next_page_token: null },
      })
    })

    it('returns an empty page on 204', async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 204, statusText: 'No Content' }))

      const result = await api().list({ passage_id: 'JHN.3.16' })

      expect(result).toEqual({
        ok: true,
        value: { data: [], next_page_token: null },
      })
    })

    it('sends page_size and page_token when those params are set', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [], next_page_token: null, total_size: 0 }))

      const result = await api().list({
        passage_id: 'JHN.3.16',
        page_size: 10,
        page_token: 'cursor-1',
      })

      expect(result).toEqual({
        ok: true,
        value: { data: [], next_page_token: null, total_size: 0 },
      })

      const { url } = lastRequest()
      expect(url.searchParams.get('page_size')).toBe('10')
      expect(url.searchParams.get('page_token')).toBe('cursor-1')
    })

    it('omits total_size when the wire omits it', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }))

      const result = await api().list({})

      expect(result).toEqual({
        ok: true,
        value: { data: [], next_page_token: null },
      })
      expect(lastRequest().url.searchParams.has('passage_id')).toBe(false)
    })

    it('keeps a numeric total_size, including zero', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [SAMPLE_IMAGE], total_size: 42 }))

      const result = await api().list({ passage_id: 'JHN.3.16' })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.total_size).toBe(42)
    })

    it('turns an empty next_page_token into null and drops a null total_size', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [], next_page_token: '', total_size: null }))

      const result = await api().list({})

      expect(result).toEqual({
        ok: true,
        value: { data: [], next_page_token: null },
      })
    })

    it('maps 401 to auth without throwing', async () => {
      mockFetch.mockResolvedValue(errorResponse(401))

      const result = await api().list({ passage_id: 'JHN.3.16' })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toMatchObject({ kind: 'auth', status: 401 })
    })

    it('maps 400 for a chapter id to invalid-parameter', async () => {
      mockFetch.mockResolvedValue(errorResponse(400))

      const result = await api().list({ passage_id: 'JHN.3' })

      expect(result).toEqual({
        ok: false,
        error: {
          kind: 'invalid-parameter',
          message: 'HTTP error! status: 400',
        },
      })
      expect(lastRequest().url.searchParams.get('passage_id')).toBe('JHN.3')
    })

    it('maps invalid page_size and empty language_ranges to invalid-parameter without fetching', async () => {
      const pageSizeZero = await api().list({ page_size: 0 })
      expect(pageSizeZero.ok).toBe(false)
      if (pageSizeZero.ok) return
      expect(pageSizeZero.error.kind).toBe('invalid-parameter')

      const pageSizeHigh = await api().list({ page_size: 100 })
      expect(pageSizeHigh.ok).toBe(false)
      if (pageSizeHigh.ok) return
      expect(pageSizeHigh.error.kind).toBe('invalid-parameter')

      const emptyRanges = await api().list({ language_ranges: [] })
      expect(emptyRanges.ok).toBe(false)
      if (emptyRanges.ok) return
      expect(emptyRanges.error.kind).toBe('invalid-parameter')

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns an empty page when the JSON body is empty', async () => {
      mockFetch.mockResolvedValue(
        new Response('', { status: 200, headers: { 'content-type': 'application/json' } }),
      )

      const result = await api().list({})

      expect(result).toEqual({
        ok: true,
        value: { data: [], next_page_token: null },
      })
    })

    it('maps 403 to auth and a bad payload to transient', async () => {
      mockFetch.mockResolvedValue(errorResponse(403))
      const forbidden = await api().list({})
      expect(forbidden.ok).toBe(false)
      if (forbidden.ok) return
      expect(forbidden.error).toMatchObject({ kind: 'auth', status: 403 })

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ unexpected: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      const badPayload = await api().list({})
      expect(badPayload.ok).toBe(false)
      if (badPayload.ok) return
      expect(badPayload.error.kind).toBe('transient')
      if (badPayload.error.kind !== 'transient') return
      expect(badPayload.error.message.startsWith('Unexpected images API response')).toBe(true)
    })
  })

  describe('get', () => {
    it('encodes the id once and returns the image record', async () => {
      mockFetch.mockResolvedValue(jsonResponse(SAMPLE_IMAGE))

      const result = await api().get('photo/1')

      expect(result).toEqual({
        ok: true,
        value: SAMPLE_IMAGE,
      })

      expect(String(mockFetch.mock.calls[0]?.[0])).toBe(
        'https://api.example.com/v1/images/photo%2F1',
      )
    })

    it('maps a missing image to not-found', async () => {
      mockFetch.mockResolvedValue(errorResponse(404))

      const result = await api().get('missing')

      expect(result).toEqual({
        ok: false,
        error: {
          kind: 'not-found',
          status: 404,
          message: 'HTTP error! status: 404',
        },
      })
    })

    it('maps a blank id to invalid-parameter without fetching', async () => {
      const empty = await api().get('')
      expect(empty.ok).toBe(false)
      if (empty.ok) return
      expect(empty.error.kind).toBe('invalid-parameter')

      const blank = await api().get('   ')
      expect(blank.ok).toBe(false)
      if (blank.ok) return
      expect(blank.error.kind).toBe('invalid-parameter')

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('maps a body that fails the image schema to transient', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ unexpected: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )

      const result = await api().get('img-1')

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.kind).toBe('transient')
      if (result.error.kind !== 'transient') return
      expect(result.error.message.startsWith('Unexpected images API response')).toBe(true)
    })
  })

  it('maps a network failure to transient without a status', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'))

    const result = await api().list({})

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toEqual({
      kind: 'transient',
      message: 'Network request failed',
    })
  })
})
