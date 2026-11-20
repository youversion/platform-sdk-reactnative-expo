import { createVideosApi } from '../api'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

type LastRequest = {
  url: URL
  init: RequestInit
}

function jsonResponse<Body>(body: Body, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function lastRequest(): LastRequest {
  const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  if (call === undefined) {
    throw new Error('expected fetch to have been called')
  }
  return { url: new URL(String(call[0])), init: call[1] ?? {} }
}

const api = () =>
  createVideosApi({
    appKey: 'appkey',
    apiHost: 'api.example.com',
    installationId: 'inst-1',
  })

const videoBody = {
  id: 'video/id',
  title: 'La historia',
  description: null,
  passage_id: 'JHN.3.16',
  language_tag: 'es',
  runtime: 90,
  orientation: 'landscape',
  thumbnail: {
    url: 'https://cdn.example/video.jpg?size=thumb&token=a%2Fb#frame',
    width: 1280,
    height: 720,
  },
  playback_sources: [{ url: 'https://cdn.example/video.m3u8', format: 'hls' }],
  playback_preview_sources: [{ url: 'https://cdn.example/preview.mp4', format: 'mp4' }],
  share_url: 'https://www.bible.com/videos/video-id',
  references: ['JHN.3.16'],
  ignored: true,
}

describe('createVideosApi', () => {
  it('gets a video by an opaque id and resolves the thumbnail without an app key', async () => {
    mockFetch.mockResolvedValue(jsonResponse(videoBody))

    const result = await api().get('video/id', {
      acceptLanguage: 'es',
      thumbnailSize: 'card',
    })

    expect(result).toEqual({
      ok: true,
      value: {
        id: 'video/id',
        title: 'La historia',
        description: null,
        passage_id: 'JHN.3.16',
        language_tag: 'es',
        runtime: 90,
        orientation: 'landscape',
        thumbnail: {
          url: 'https://cdn.example/video.jpg?token=a%2Fb&size=card#frame',
          width: 1280,
          height: 720,
        },
        playback_sources: [{ url: 'https://cdn.example/video.m3u8', format: 'hls' }],
        playback_preview_sources: [{ url: 'https://cdn.example/preview.mp4', format: 'mp4' }],
        share_url: 'https://www.bible.com/videos/video-id',
      },
    })
    const { url, init } = lastRequest()
    expect(url.href).toBe('https://api.example.com/v1/videos/video%2Fid')
    expect(new Headers(init.headers).get('Accept-Language')).toBe('es')
    expect(new Headers(init.headers).get('X-YVP-App-Key')).toBe('appkey')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('keeps null optional fields and empty playback lists', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        id: 'bare-id',
        title: null,
        description: null,
        passage_id: null,
        language_tag: null,
        runtime: null,
        orientation: null,
        thumbnail: { url: null, width: null, height: null },
        playback_sources: [],
        playback_preview_sources: [],
        share_url: null,
      }),
    )

    const result = await api().get('bare-id')

    expect(result).toEqual({
      ok: true,
      value: {
        id: 'bare-id',
        title: null,
        description: null,
        passage_id: null,
        language_tag: null,
        runtime: null,
        orientation: null,
        thumbnail: { url: null, width: null, height: null },
        playback_sources: [],
        playback_preview_sources: [],
        share_url: null,
      },
    })
    expect(new Headers(lastRequest().init.headers).has('Accept-Language')).toBe(false)
  })

  it('selects thumbnail renditions and preserves unrelated query bytes', async () => {
    function thumbnailUrl(id: string): string | null {
      if (id === 'untouched') return 'https://cdn.example/video.jpg?signature=a%20b&flag#frame'
      if (id === 'default') return 'https://cdn.example/video.jpg?size=thumb&size=card&token=one#frame'
      if (id === 'thumb') return 'https://cdn.example/video.jpg?size=card&signature=a%20b&flag#frame'
      if (id === 'full') return 'https://cdn.example/video.jpg?size=thumb&token=one#frame'
      if (id === 'encoded') return 'https://cdn.example/video.jpg?%73ize=thumb&token=one'
      if (id === 'broken') return 'https://cdn.example/video.jpg?%&token=one'
      if (id === 'size-only') return 'https://cdn.example/video.jpg?size=thumb#frame'
      return null
    }
    mockFetch.mockImplementation(async (input) => {
      const id = decodeURIComponent(new URL(String(input)).pathname.split('/').pop() ?? '')
      return jsonResponse({
        id,
        thumbnail: { url: thumbnailUrl(id), width: null, height: null },
        playback_sources: [],
        playback_preview_sources: [],
      })
    })

    const untouched = await api().get('untouched')
    const defaultSize = await api().get('default')
    const thumbnail = await api().get('thumb', { thumbnailSize: 'thumb' })
    const full = await api().get('full', { thumbnailSize: 'full' })
    const encoded = await api().get('encoded')
    const broken = await api().get('broken')
    const sizeOnly = await api().get('size-only')

    expect(untouched.ok && untouched.value.thumbnail?.url).toBe(
      'https://cdn.example/video.jpg?signature=a%20b&flag#frame',
    )
    expect(defaultSize.ok && defaultSize.value.thumbnail?.url).toBe(
      'https://cdn.example/video.jpg?token=one#frame',
    )
    expect(thumbnail.ok && thumbnail.value.thumbnail?.url).toBe(
      'https://cdn.example/video.jpg?signature=a%20b&flag&size=thumb#frame',
    )
    expect(full.ok && full.value.thumbnail?.url).toBe(
      'https://cdn.example/video.jpg?token=one&size=full#frame',
    )
    expect(encoded.ok && encoded.value.thumbnail?.url).toBe('https://cdn.example/video.jpg?token=one')
    expect(broken.ok && broken.value.thumbnail?.url).toBe(
      'https://cdn.example/video.jpg?%&token=one',
    )
    expect(sizeOnly.ok && sizeOnly.value.thumbnail?.url).toBe('https://cdn.example/video.jpg#frame')
  })

  it('does not coerce a numeric id or invent a passage from references', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        id: 52186,
        references: ['JHN.3.16'],
        playback_sources: [],
        playback_preview_sources: [],
      }),
    )

    const result = await api().get('52186')

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('transient')
    if (result.error.kind !== 'transient') return
    expect(result.error.message.startsWith('Unexpected videos API response')).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('surfaces a metadata 404 and does not retry', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 404 }))

    const result = await api().get('search-issued-id')

    expect(result).toEqual({
      ok: false,
      error: { kind: 'not-found', status: 404, message: 'HTTP error! status: 404' },
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('maps auth, client, and transport failures', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }))
    const missingKey = await createVideosApi({
      appKey: '',
      apiHost: 'api.example.com',
      installationId: 'inst-1',
    }).get('video-id')
    expect(missingKey.ok).toBe(false)
    if (missingKey.ok) return
    expect(missingKey.error).toMatchObject({ kind: 'auth', status: 401 })
    expect(new Headers(lastRequest().init.headers).get('X-YVP-App-Key')).toBe('')

    mockFetch.mockResolvedValueOnce(new Response('', { status: 403 }))
    const forbidden = await api().get('video-id')
    expect(forbidden.ok).toBe(false)
    if (forbidden.ok) return
    expect(forbidden.error).toMatchObject({ kind: 'auth', status: 403 })

    mockFetch.mockResolvedValueOnce(new Response('', { status: 400 }))
    const invalid = await api().get('video-id')
    expect(invalid.ok).toBe(false)
    if (invalid.ok) return
    expect(invalid.error).toMatchObject({ kind: 'invalid-parameter', status: 400 })

    mockFetch.mockResolvedValueOnce(new Response('', { status: 408 }))
    const timeout = await api().get('video-id')
    expect(timeout.ok).toBe(false)
    if (timeout.ok) return
    expect(timeout.error).toMatchObject({ kind: 'transient', status: 408 })

    mockFetch.mockResolvedValueOnce(new Response('', { status: 429 }))
    const limited = await api().get('video-id')
    expect(limited.ok).toBe(false)
    if (limited.ok) return
    expect(limited.error).toMatchObject({ kind: 'transient', status: 429 })

    mockFetch.mockResolvedValueOnce(new Response('', { status: 500 }))
    const failed = await api().get('video-id')
    expect(failed.ok).toBe(false)
    if (failed.ok) return
    expect(failed.error).toMatchObject({ kind: 'transient', status: 500 })

    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'))
    const network = await api().get('video-id')
    expect(network).toEqual({
      ok: false,
      error: { kind: 'transient', message: 'Network request failed' },
    })
  })

  it('rejects blank, dot, and lone-surrogate ids before fetching', async () => {
    const blank = await api().get('   ')
    const dot = await api().get('..')
    const surrogate = await api().get('\ud800')
    const badSize = await api().get('video-id', {
      // @ts-expect-error poster is not a thumbnail rendition
      thumbnailSize: 'poster',
    })

    expect(blank.ok).toBe(false)
    expect(dot.ok).toBe(false)
    expect(surrogate.ok).toBe(false)
    expect(badSize.ok).toBe(false)
    if (!blank.ok) expect(blank.error.kind).toBe('invalid-parameter')
    if (!dot.ok) expect(dot.error.message).toContain('Video ID must not be a URL dot segment')
    if (!surrogate.ok) expect(surrogate.error.message).toContain('Video ID must contain valid Unicode')
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
