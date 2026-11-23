import { createSearchApi } from '../api'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

const organizationIds = [
  '550e8400-e29b-41d4-a716-446655440000',
  '09d8dc67-6b79-4db8-95fb-b9055258b85b',
]

function jsonResponse<Body>(body: Body, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function lastCall() {
  const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  if (call === undefined) {
    throw new Error('expected fetch to have been called')
  }
  return { url: new URL(String(call[0])), init: call[1] ?? {} }
}

const api = () =>
  createSearchApi({
    appKey: 'appkey',
    apiHost: 'api.example.com',
    installationId: 'inst-1',
  })

describe('createSearchApi videos', () => {
  it('searches full videos on the beta route and strips thumbnail size', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        videos: [
          {
            id: 'opaque-video-id',
            title: 'Teaching clip',
            description: null,
            thumbnail: {
              url: 'https://cdn.example/video.jpg?size=card&token=x%2Fy#poster',
              width: 640,
              height: 360,
            },
            playback_sources: [],
            playback_preview_sources: [],
          },
        ],
        user_intent: 'topical',
        did_you_mean: ['teaching clip'],
        search_instead_for: null,
        next_page_token: 'last-page',
      }),
    )

    const result = await api().videos({
      query: 'teaching clips',
      organizationIds,
      pageSize: 12,
      pageToken: 'a+/=&b',
    })

    expect(result).toEqual({
      ok: true,
      value: {
        videos: [
          {
            id: 'opaque-video-id',
            title: 'Teaching clip',
            description: null,
            thumbnail: {
              url: 'https://cdn.example/video.jpg?token=x%2Fy#poster',
              width: 640,
              height: 360,
            },
            playback_sources: [],
            playback_preview_sources: [],
          },
        ],
        userIntent: 'topical',
        didYouMean: ['teaching clip'],
        searchInsteadFor: null,
        nextPageToken: 'last-page',
      },
    })
    const { url, init } = lastCall()
    expect(url.pathname).toBe('/v1/search-videos')
    expect(url.searchParams.get('query')).toBe('teaching clips')
    expect(url.searchParams.getAll('organization_ids[]')).toEqual(organizationIds)
    expect(url.searchParams.get('page_size')).toBe('12')
    expect(url.searchParams.get('page_token')).toBe('a+/=&b')
    expect(new Headers(init.headers).get('Accept-Language')).toBe('en')
  })

  it('keeps an empty-page token while a later page may change size', async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          videos: [],
          user_intent: null,
          did_you_mean: [],
          search_instead_for: null,
          next_page_token: '',
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          videos: [],
          user_intent: null,
          did_you_mean: [],
          search_instead_for: null,
          next_page_token: null,
        }),
      )

    const emptyPage = await api().videos({
      query: 'hope',
      acceptLanguage: 'es-MX',
      organizationIds,
    })
    expect(emptyPage).toEqual({
      ok: true,
      value: {
        videos: [],
        didYouMean: [],
        searchInsteadFor: null,
        nextPageToken: '',
      },
    })
    const first = lastCall()
    expect(first.url.searchParams.has('page_token')).toBe(false)
    expect(new Headers(first.init.headers).get('Accept-Language')).toBe('es-MX')

    if (!emptyPage.ok) return
    const next = await api().videos({
      query: 'hope',
      acceptLanguage: 'es-MX',
      organizationIds,
      pageSize: 99,
      pageToken: emptyPage.value.nextPageToken ?? undefined,
    })
    expect(next).toEqual({
      ok: true,
      value: {
        videos: [],
        didYouMean: [],
        searchInsteadFor: null,
        nextPageToken: null,
      },
    })
    const second = lastCall()
    expect(second.url.searchParams.get('query')).toBe('hope')
    expect(second.url.searchParams.getAll('organization_ids[]')).toEqual(organizationIds)
    expect(second.url.searchParams.get('page_size')).toBe('99')
    expect(second.url.searchParams.get('page_token')).toBe('')
    expect(new Headers(second.init.headers).get('Accept-Language')).toBe('es-MX')
  })

  it('treats an empty organization list and a null cursor as the first unfiltered page', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ videos: [], did_you_mean: [], user_intent: null, search_instead_for: null }),
    )
    const query = 'é'.repeat(100)
    const result = await api().videos({ query, organizationIds: [], pageToken: null })
    expect(result.ok).toBe(true)
    const url = lastCall().url
    expect(url.searchParams.get('query')).toBe(query)
    expect(url.searchParams.has('organization_ids[]')).toBe(false)
    expect(url.searchParams.has('page_token')).toBe(false)
  })

  it('keeps a relative thumbnail and does not invent a host', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        videos: [
          {
            id: 'relative',
            thumbnail: { url: '/images/art.jpg?signature=a%2Fb&size=thumb' },
            playback_sources: [],
            playback_preview_sources: [],
          },
        ],
        did_you_mean: [],
      }),
    )
    const result = await api().videos({ query: 'love' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.videos[0]?.thumbnail?.url).toBe('/images/art.jpg?signature=a%2Fb')
    expect(result.value.searchInsteadFor).toBeNull()
    expect(result.value.userIntent).toBeUndefined()
  })

  it('rejects invalid search input before fetching', async () => {
    const empty = await api().videos({ query: '' })
    const long = await api().videos({ query: 'a'.repeat(101) })
    const page = await api().videos({ query: 'hope', pageSize: 100 })
    const org = await api().videos({ query: 'hope', organizationIds: ['not-a-uuid'] })
    for (const result of [empty, long, page, org]) {
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.kind).toBe('invalid-parameter')
    }
    if (!empty.ok) expect(empty.error.message).toContain('Query must be between 1 and 100 characters')
    if (!org.ok) expect(org.error.message).toContain('Organization ID must be a valid UUID')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('maps a bad page, an empty body, and a missing app key', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        videos: [{ id: '', playback_sources: [], playback_preview_sources: [] }],
        user_intent: null,
        did_you_mean: [],
        search_instead_for: null,
        next_page_token: null,
      }),
    )
    const malformed = await api().videos({ query: 'malformed' })
    expect(malformed.ok).toBe(false)
    if (malformed.ok) return
    expect(malformed.error.kind).toBe('transient')
    if (malformed.error.kind !== 'transient') return
    expect(malformed.error.message.startsWith('Unexpected search-videos API response')).toBe(true)

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const emptyBody = await api().videos({ query: 'empty-body' })
    expect(emptyBody.ok).toBe(false)
    if (!emptyBody.ok) expect(emptyBody.error.kind).toBe('transient')

    mockFetch.mockResolvedValueOnce(new Response('', { status: 401 }))
    const missingKey = await createSearchApi({
      appKey: '',
      apiHost: 'api.example.com',
      installationId: 'inst-1',
    }).videos({ query: 'faith' })
    expect(missingKey.ok).toBe(false)
    if (!missingKey.ok) expect(missingKey.error).toMatchObject({ kind: 'auth', status: 401 })
    expect(new Headers(lastCall().init.headers).get('X-YVP-App-Key')).toBe('')

    mockFetch.mockResolvedValueOnce(new Response('', { status: 424 }))
    const failed = await api().videos({ query: 'unavailable' })
    expect(failed.ok).toBe(false)
    if (!failed.ok) expect(failed.error).toMatchObject({ kind: 'invalid-parameter', status: 424 })
  })
})
