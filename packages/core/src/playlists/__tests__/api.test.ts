import { createPlaylistsApi } from '../api'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

const organizationId = '550e8400-e29b-41d4-a716-446655440000'

function jsonResponse<Body>(body: Body, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function lastUrl(): URL {
  const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  if (call === undefined) {
    throw new Error('expected fetch to have been called')
  }
  return new URL(String(call[0]))
}

function lastHeaders(): Headers {
  const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  return new Headers(call?.[1]?.headers)
}

const api = () =>
  createPlaylistsApi({
    appKey: 'appkey',
    apiHost: 'api.example.com',
    installationId: 'inst-1',
  })

const fullPlaylist = {
  id: 3669,
  title: 'Teaching Clips',
  description: null,
  type: 'TEACHING_CLIPS',
  total: 1,
  videos: ['52186'],
}

describe('createPlaylistsApi', () => {
  it('omits fields[] unless the caller selects fields', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ data: [fullPlaylist], next_page_token: 'next-page' }),
    )

    const result = await api().list(organizationId)

    expect(result).toEqual({
      ok: true,
      value: { data: [fullPlaylist], next_page_token: 'next-page' },
    })
    const url = lastUrl()
    expect(url.pathname).toBe(`/v1/organizations/${organizationId}/playlists`)
    expect(url.searchParams.has('fields[]')).toBe(false)
    expect(url.searchParams.has('page_size')).toBe(false)
    expect(lastHeaders().get('Accept-Language')).toBe('en')
  })

  it('sends selected fields, a star page size, and an opaque page token', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        data: [{ id: 3669, title: 'Teaching Clips', videos: ['video/id'] }],
        next_page_token: null,
      }),
    )

    const result = await api().list(organizationId, {
      fields: ['id', 'videos', 'title'],
      page_size: '*',
      page_token: 'a+/=&b',
      accept_language: 'en',
    })

    expect(result).toEqual({
      ok: true,
      value: {
        data: [{ id: 3669, title: 'Teaching Clips', videos: ['video/id'] }],
        next_page_token: null,
      },
    })
    const url = lastUrl()
    expect(url.searchParams.getAll('fields[]')).toEqual(['id', 'videos', 'title'])
    expect(url.searchParams.get('page_size')).toBe('*')
    expect(url.searchParams.get('page_token')).toBe('a+/=&b')
  })

  it('keeps an empty continuation token and maps 204 to an empty page', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: [fullPlaylist], next_page_token: '' }),
    )
    const first = await api().list(organizationId, { page_token: '' })
    expect(first).toEqual({
      ok: true,
      value: { data: [fullPlaylist], next_page_token: '' },
    })
    expect(lastUrl().searchParams.get('page_token')).toBe('')
    expect(lastUrl().searchParams.has('page_token')).toBe(true)

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    const empty = await api().list(organizationId, { accept_language: 'de' })
    expect(empty).toEqual({
      ok: true,
      value: { data: [], next_page_token: null },
    })
    expect(lastHeaders().get('Accept-Language')).toBe('de')

    mockFetch.mockResolvedValueOnce(
      new Response('', { status: 200, headers: { 'content-type': 'application/json' } }),
    )
    const blank = await api().list(organizationId, { accept_language: 'it' })
    expect(blank).toEqual({
      ok: true,
      value: { data: [], next_page_token: null },
    })
  })

  it('gets one playlist and keeps a null description', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        id: 3669,
        title: 'Clips de enseñanza',
        description: null,
        type: 'TEACHING_CLIPS',
        total: 1,
        videos: ['52186'],
      }),
    )

    const result = await api().get(organizationId, 3669, { accept_language: 'es' })

    expect(result).toEqual({
      ok: true,
      value: {
        id: 3669,
        title: 'Clips de enseñanza',
        description: null,
        type: 'TEACHING_CLIPS',
        total: 1,
        videos: ['52186'],
      },
    })
    expect(lastUrl().pathname).toBe(`/v1/organizations/${organizationId}/playlists/3669`)
    expect(lastHeaders().get('Accept-Language')).toBe('es')
  })

  it('rejects invalid playlist parameters before fetching', async () => {
    const badOrg = await api().list('not-a-uuid')
    const star = await api().list(organizationId, { page_size: '*' })
    const tooMany = await api().list(organizationId, {
      page_size: '*',
      fields: ['id', 'title', 'total', 'videos'],
    })
    const zero = await api().list(organizationId, { page_size: 0 })
    const hundred = await api().list(organizationId, { page_size: 100 })
    const playlistId = await api().get(organizationId, 2_147_483_648)

    expect(badOrg.ok).toBe(false)
    if (!badOrg.ok) expect(badOrg.error.message).toContain('Organization ID must be a valid UUID')
    expect(star.ok).toBe(false)
    if (!star.ok) {
      expect(star.error.message).toContain('requires 1-3 fields to be specified')
    }
    expect(tooMany.ok).toBe(false)
    if (!tooMany.ok) expect(tooMany.error.message).toContain('requires 1-3 fields')
    expect(zero.ok).toBe(false)
    if (!zero.ok) expect(zero.error.message).toContain('Page size must be an integer from 1 to 99')
    expect(hundred.ok).toBe(false)
    expect(playlistId.ok).toBe(false)
    if (!playlistId.ok) {
      expect(playlistId.error.message).toContain('Playlist ID must be a 32-bit integer')
    }
    for (const result of [badOrg, star, tooMany, zero, hundred, playlistId]) {
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error.kind).toBe('invalid-parameter')
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('maps a partial playlist body, auth, and not-found', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 3669 }))
    const partial = await api().get(organizationId, 3669)
    expect(partial.ok).toBe(false)
    if (partial.ok) return
    expect(partial.error.kind).toBe('transient')
    if (partial.error.kind !== 'transient') return
    expect(partial.error.message.startsWith('Unexpected playlists API response')).toBe(true)

    mockFetch.mockResolvedValueOnce(jsonResponse(null))
    const nullBody = await api().list(organizationId, { page_token: 'null-body' })
    expect(nullBody.ok).toBe(false)
    if (!nullBody.ok) expect(nullBody.error.kind).toBe('transient')

    mockFetch.mockResolvedValueOnce(new Response('', { status: 403 }))
    const forbidden = await api().list(organizationId)
    expect(forbidden.ok).toBe(false)
    if (!forbidden.ok) expect(forbidden.error).toMatchObject({ kind: 'auth', status: 403 })

    mockFetch.mockResolvedValueOnce(new Response('', { status: 404 }))
    const missing = await api().get(organizationId, 3669)
    expect(missing.ok).toBe(false)
    if (!missing.ok) expect(missing.error).toMatchObject({ kind: 'not-found', status: 404 })

    mockFetch.mockResolvedValueOnce(new Response('', { status: 422 }))
    const invalid = await api().list(organizationId)
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.error).toMatchObject({ kind: 'invalid-parameter', status: 422 })

    mockFetch.mockRejectedValueOnce(new TypeError('Network request failed'))
    const network = await api().list(organizationId)
    expect(network).toEqual({
      ok: false,
      error: { kind: 'transient', message: 'Network request failed' },
    })
  })
})
