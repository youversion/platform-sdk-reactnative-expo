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
    it('GETs /v1-beta/images with passage_id and language_ranges[] unchanged in case', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          data: [SAMPLE_IMAGE],
          next_page_token: 'next',
          total_size: 1,
        }),
      )

      const result = await api().list({
        passageId: 'JHN.3.16',
        languageRanges: ['en-US', 'pt_BR'],
      })

      expect(result).toEqual({
        ok: true,
        value: {
          images: [
            {
              id: 'img-1',
              imageUrl: 'https://cdn.example.com/img-1.jpg',
              passageId: 'JHN.3.16',
              attribution: 'YouVersion',
              languageTag: 'en-US',
              width: 1200,
              height: 800,
              aspectRatio: 1.5,
            },
          ],
          nextPageToken: 'next',
          totalSize: 1,
        },
      })

      const { url, init } = lastRequest()
      expect(url.origin + url.pathname).toBe('https://api.example.com/v1-beta/images')
      expect(url.searchParams.get('passage_id')).toBe('JHN.3.16')
      expect(url.searchParams.getAll('language_ranges[]')).toEqual(['en-US', 'pt_BR'])
      expect(init.method).toBe('GET')
    })

    it('returns an empty page when data is an empty array', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }))

      const result = await api().list({ passageId: 'JHN.3.16' })

      expect(result).toEqual({
        ok: true,
        value: { images: [], nextPageToken: null, totalSize: null },
      })
    })

    it('returns an empty page on 204', async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 204, statusText: 'No Content' }))

      const result = await api().list({ passageId: 'JHN.3.16' })

      expect(result).toEqual({
        ok: true,
        value: { images: [], nextPageToken: null, totalSize: null },
      })
    })

    it('sends page_size and page_token when those params are set', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [], next_page_token: null, total_size: 0 }))

      const result = await api().list({
        passageId: 'JHN.3.16',
        pageSize: 10,
        pageToken: 'cursor-1',
      })

      expect(result).toEqual({
        ok: true,
        value: { images: [], nextPageToken: null, totalSize: 0 },
      })

      const { url } = lastRequest()
      expect(url.searchParams.get('page_size')).toBe('10')
      expect(url.searchParams.get('page_token')).toBe('cursor-1')
    })

    it('leaves totalSize null when the wire omits total_size', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [] }))

      const result = await api().list({})

      expect(result).toEqual({
        ok: true,
        value: { images: [], nextPageToken: null, totalSize: null },
      })
      expect(lastRequest().url.searchParams.has('passage_id')).toBe(false)
    })

    it('returns a numeric total_size as totalSize', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [SAMPLE_IMAGE], total_size: 42 }))

      const result = await api().list({ passageId: 'JHN.3.16' })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.totalSize).toBe(42)
    })

    it('maps an empty next_page_token and a null total_size to null', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ data: [], next_page_token: '', total_size: null }),
      )

      const result = await api().list({})

      expect(result).toEqual({
        ok: true,
        value: { images: [], nextPageToken: null, totalSize: null },
      })
    })

    it('maps 401 to auth without throwing', async () => {
      mockFetch.mockResolvedValue(errorResponse(401))

      const result = await api().list({ passageId: 'JHN.3.16' })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error).toMatchObject({ kind: 'auth', status: 401 })
    })

    it('maps 400 for a chapter id to transient with status 400', async () => {
      mockFetch.mockResolvedValue(errorResponse(400))

      const result = await api().list({ passageId: 'JHN.3' })

      expect(result).toEqual({
        ok: false,
        error: {
          kind: 'transient',
          status: 400,
          message: 'HTTP error! status: 400',
        },
      })
      expect(lastRequest().url.searchParams.get('passage_id')).toBe('JHN.3')
    })

    it('maps invalid pageSize and empty languageRanges to invalid-parameter without fetching', async () => {
      const pageSizeZero = await api().list({ pageSize: 0 })
      expect(pageSizeZero.ok).toBe(false)
      if (pageSizeZero.ok) return
      expect(pageSizeZero.error.kind).toBe('invalid-parameter')

      const pageSizeHigh = await api().list({ pageSize: 100 })
      expect(pageSizeHigh.ok).toBe(false)
      if (pageSizeHigh.ok) return
      expect(pageSizeHigh.error.kind).toBe('invalid-parameter')

      const emptyRanges = await api().list({ languageRanges: [] })
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
        value: { images: [], nextPageToken: null, totalSize: null },
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
      expect(badPayload.error).toEqual({
        kind: 'transient',
        message: 'Unexpected images API response',
      })
    })
  })

  describe('get', () => {
    it('encodes the id once and returns the camelCase record', async () => {
      mockFetch.mockResolvedValue(jsonResponse(SAMPLE_IMAGE))

      const result = await api().get('photo/1')

      expect(result).toEqual({
        ok: true,
        value: {
          id: 'img-1',
          imageUrl: 'https://cdn.example.com/img-1.jpg',
          passageId: 'JHN.3.16',
          attribution: 'YouVersion',
          languageTag: 'en-US',
          width: 1200,
          height: 800,
          aspectRatio: 1.5,
        },
      })

      expect(String(mockFetch.mock.calls[0]?.[0])).toBe(
        'https://api.example.com/v1-beta/images/photo%2F1',
      )
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

      expect(result).toEqual({
        ok: false,
        error: { kind: 'transient', message: 'Unexpected images API response' },
      })
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
