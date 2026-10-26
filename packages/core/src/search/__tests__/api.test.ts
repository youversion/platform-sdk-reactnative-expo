import type { SearchUnifiedParams } from '../../index'
import { createSearchApi } from '../api'
import { SEARCH_USER_INTENT } from '../types'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

type SearchQueryRecord = {
  text: string
  source?: string | null
}

type SearchQueriesJson = {
  data: SearchQueryRecord[]
}

type VerseRecord = {
  reference?: string
  unexpected?: boolean
}

type VersesJson = {
  verses: VerseRecord[]
  user_intent?: string | null
  did_you_mean?: string[]
  search_instead_for?: string | null
  next_page_token?: string | null
}

type TopicRecord = {
  id?: number | null
  text: string
  subtopics: string[]
}

type TopicsJson = {
  topics: TopicRecord[]
  did_you_mean: string[]
  search_instead_for?: string | null
  total_size: number
}

type UnifiedJson = {
  verses?: unknown[]
  topics?: unknown[]
  images?: unknown[]
  user_intent?: string | null
  did_you_mean?: string[]
  search_instead_for?: string | null
}

type SearchJson = SearchQueriesJson | VersesJson | TopicsJson | UnifiedJson

type LastRequest = {
  url: URL
  init: RequestInit
}

function jsonResponse(body: SearchJson, status = 200): Response {
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
  createSearchApi({
    appKey: 'appkey',
    apiHost: 'api.example.com',
    installationId: 'inst-1',
  })

describe('createSearchApi', () => {
  describe('unified', () => {
    it('serializes mixed fields and returns shared verse, topic, and image DTOs', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          verses: [{ reference: 'JHN.3.16' }, { reference: 'bad-reference' }, null],
          topics: [{ id: null, text: 'Love', subtopics: ['grace'] }],
          images: [
            { id: 'opaque+/=id', passage_id: '1CO.13.4-7', image_url: 'not-search-metadata' },
            { id: '', passage_id: 'JHN.3.16' },
            { id: 'bad-passage', passage_id: 'not-usfm' },
            { id: 'missing-passage' },
          ],
          user_intent: 'future-intent',
          did_you_mean: ['love'],
          search_instead_for: 'love',
        }),
      )

      expect(
        await api().unified({
          query: ' love & hope ',
          bibleId: 111,
          languageRanges: ['EN_us', 'es', '*'],
          fields: ['images', 'verses', 'topics', 'images'],
          userIntent: SEARCH_USER_INTENT.topical,
        }),
      ).toEqual({
        ok: true,
        value: {
          verses: [{ id: 'JHN.3.16' }],
          topics: [{ id: null, text: 'Love', subtopics: ['grace'] }],
          images: [{ id: 'opaque+/=id', passageId: '1CO.13.4-7' }],
          userIntent: 'future-intent',
          didYouMean: ['love'],
          searchInsteadFor: 'love',
        },
      })
      const { url, init } = lastRequest()
      expect(url.origin + url.pathname).toBe('https://api.example.com/v1/search-unified')
      expect(url.searchParams.get('query')).toBe('love & hope')
      expect(url.searchParams.get('bible_id')).toBe('111')
      expect(url.searchParams.getAll('language_ranges[]')).toEqual(['en-us', 'es', '*'])
      expect(url.searchParams.getAll('fields[]')).toEqual(['images', 'verses', 'topics'])
      expect(url.searchParams.get('user_intent')).toBe('topical')
      expect(url.searchParams.has('page_size')).toBe(false)
      expect(url.searchParams.has('page_token')).toBe(false)
      expect(init.method).toBe('GET')
      expect(header(init, 'X-YVP-App-Key')).toBe('appkey')
      expect(header(init, 'X-YVP-Installation-Id')).toBe('inst-1')
      expect(header(init, 'X-YVP-Sdk')).toBe('ReactSDK=2.16.0')
    })

    it('supports image-only responses without inventing full image metadata', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ images: [{ id: 'art-2', passage_id: 'PSA.23.1' }] }),
      )
      expect(
        await api().unified({
          query: 'peace',
          bibleId: 206,
          languageRanges: ['es'],
          fields: ['images'],
        }),
      ).toEqual({
        ok: true,
        value: {
          images: [{ id: 'art-2', passageId: 'PSA.23.1' }],
          verses: [],
          topics: [],
          didYouMean: [],
          searchInsteadFor: null,
        },
      })
      expect(lastRequest().url.searchParams.getAll('fields[]')).toEqual(['images'])
    })

    it('keeps service defaults and accepts legacy responses without images', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ verses: [{ reference: 'ROM.8.28' }] }))
      expect(await api().unified({ query: 'hope', bibleId: 111, languageRanges: ['en'] })).toEqual({
        ok: true,
        value: {
          verses: [{ id: 'ROM.8.28' }],
          topics: [],
          images: [],
          didYouMean: [],
          searchInsteadFor: null,
        },
      })
      expect(lastRequest().url.searchParams.has('fields[]')).toBe(false)
      expect(lastRequest().url.searchParams.has('user_intent')).toBe(false)
    })

    it('maps invalid inputs to invalid-parameter before fetching', async () => {
      const params = { query: 'love', bibleId: 111, languageRanges: ['en'] }
      const cases = [
        { query: '' },
        { query: 'a'.repeat(101) },
        { bibleId: 0 },
        { languageRanges: [] },
        { languageRanges: ['en--US'] },
        { fields: [] },
        // @ts-expect-error Unsupported fields must fail both the public type and runtime validation.
        { fields: ['videos'] } satisfies Partial<SearchUnifiedParams>,
        // @ts-expect-error Unified Search accepts only known request intents, unlike response intents.
        { userIntent: 'future-intent' } satisfies Partial<SearchUnifiedParams>,
      ]
      for (const invalid of cases) {
        // @ts-expect-error Exercise runtime validation for JavaScript callers as well.
        expect(await api().unified({ ...params, ...invalid })).toMatchObject({
          ok: false,
          error: { kind: 'invalid-parameter' },
        })
      }
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it.each([401, 403, 400, 404, 429, 500])(
      'maps HTTP %i through the existing Result model',
      async (status) => {
        mockFetch.mockResolvedValue(errorResponse(status))
        expect(
          await api().unified({ query: 'love', bibleId: 111, languageRanges: ['en'] }),
        ).toMatchObject({
          ok: false,
          error: { kind: status === 401 || status === 403 ? 'auth' : 'transient', status },
        })
      },
    )

    it('maps malformed responses and transport failures to transient errors', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ images: 'not-an-array' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      expect(
        await api().unified({ query: 'love', bibleId: 111, languageRanges: ['en'] }),
      ).toMatchObject({
        ok: false,
        error: {
          kind: 'transient',
          message: expect.stringContaining('Unexpected search-unified API response'),
        },
      })
      mockFetch.mockRejectedValue(new TypeError('Network request failed'))
      expect(
        await api().unified({ query: 'love', bibleId: 111, languageRanges: ['en'] }),
      ).toMatchObject({
        ok: false,
        error: { kind: 'transient' },
      })
    })
  })

  describe('suggestedQueries', () => {
    it('GETs search-queries with query, language ranges, and YVP headers', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          data: [
            { text: 'whom shall I fear', source: 'community' },
            { text: 'whom have I in heaven', source: null },
          ],
        }),
      )

      const result = await api().suggestedQueries({
        query: 'whom',
        languageRanges: ['en-US', 'es'],
      })

      expect(result).toEqual({
        ok: true,
        value: {
          queries: [
            { text: 'whom shall I fear', source: 'community' },
            { text: 'whom have I in heaven' },
          ],
        },
      })

      const { url, init } = lastRequest()
      expect(url.origin + url.pathname).toBe('https://api.example.com/v1/search-queries')
      expect(url.searchParams.get('query')).toBe('whom')
      expect(url.searchParams.getAll('language_ranges[]')).toEqual(['en-us', 'es'])
      expect(url.searchParams.has('trending')).toBe(false)
      expect(init.method).toBe('GET')
      expect(header(init, 'X-YVP-App-Key')).toBe('appkey')
      expect(header(init, 'X-YVP-Installation-Id')).toBe('inst-1')
      expect(header(init, 'X-YVP-Sdk')).toBe('ReactSDK=2.16.0')
    })

    it('returns empty queries on 204 without treating it as an error', async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 204, statusText: 'No Content' }))

      const result = await api().suggestedQueries({ query: 'love', languageRanges: ['en'] })

      expect(result).toEqual({ ok: true, value: { queries: [] } })
    })

    it('maps an empty query to invalid-parameter without fetching', async () => {
      const result = await api().suggestedQueries({ query: '', languageRanges: ['en'] })

      expect(result.ok).toBe(false)
      if (result.ok) return
      expect(result.error.kind).toBe('invalid-parameter')
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('maps empty or invalid language ranges to invalid-parameter without fetching', async () => {
      const empty = await api().suggestedQueries({ query: 'love', languageRanges: [] })
      expect(empty.ok).toBe(false)
      if (empty.ok) return
      expect(empty.error.kind).toBe('invalid-parameter')

      const blank = await api().suggestedQueries({ query: 'love', languageRanges: [''] })
      expect(blank.ok).toBe(false)
      if (blank.ok) return
      expect(blank.error.kind).toBe('invalid-parameter')

      const bad = await api().suggestedQueries({ query: 'love', languageRanges: ['en--US'] })
      expect(bad.ok).toBe(false)
      if (bad.ok) return
      expect(bad.error.kind).toBe('invalid-parameter')

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('trendingQueries', () => {
    it('GETs search-queries with trending=true and no query', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ data: [{ text: 'love', source: 'trending' }] }))

      const result = await api().trendingQueries({ languageRanges: ['en'] })

      expect(result).toEqual({
        ok: true,
        value: { queries: [{ text: 'love', source: 'trending' }] },
      })

      const { url } = lastRequest()
      expect(url.pathname).toBe('/v1/search-queries')
      expect(url.searchParams.get('trending')).toBe('true')
      expect(url.searchParams.has('query')).toBe(false)
      expect(url.searchParams.getAll('language_ranges[]')).toEqual(['en'])
    })

    it('returns empty queries on 204', async () => {
      mockFetch.mockResolvedValue(new Response(null, { status: 204, statusText: 'No Content' }))

      const result = await api().trendingQueries({ languageRanges: ['*'] })

      expect(result).toEqual({ ok: true, value: { queries: [] } })
    })
  })

  describe('verses', () => {
    it('GETs search-verses and maps wire reference to id', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          verses: [{ reference: 'MAT.14.17' }, { reference: 'JHN.6.9' }],
          user_intent: 'text',
          did_you_mean: ['two fishes'],
          search_instead_for: null,
          next_page_token: 'next-token',
        }),
      )

      const result = await api().verses({
        query: 'two fish',
        bibleId: 111,
        userIntent: SEARCH_USER_INTENT.text,
        pageSize: 25,
        pageToken: 'current-token',
      })

      expect(result).toEqual({
        ok: true,
        value: {
          verses: [{ id: 'MAT.14.17' }, { id: 'JHN.6.9' }],
          userIntent: 'text',
          didYouMean: ['two fishes'],
          searchInsteadFor: null,
          nextPageToken: 'next-token',
        },
      })

      const { url, init } = lastRequest()
      expect(url.origin + url.pathname).toBe('https://api.example.com/v1/search-verses')
      expect(url.searchParams.get('query')).toBe('two fish')
      expect(url.searchParams.get('bible_id')).toBe('111')
      expect(url.searchParams.get('user_intent')).toBe('text')
      expect(url.searchParams.get('page_size')).toBe('25')
      expect(url.searchParams.get('page_token')).toBe('current-token')
      expect(header(init, 'X-YVP-App-Key')).toBe('appkey')
      expect(header(init, 'X-YVP-Installation-Id')).toBe('inst-1')
      expect(header(init, 'X-YVP-Sdk')).toBe('ReactSDK=2.16.0')
    })

    it('omits user_intent when unset and preserves future server values', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          verses: [],
          user_intent: 'future-intent',
          did_you_mean: [],
          search_instead_for: null,
        }),
      )

      const result = await api().verses({ query: 'love', bibleId: 111 })

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value.userIntent).toBe('future-intent')

      const { url } = lastRequest()
      expect(url.searchParams.has('user_intent')).toBe(false)
    })

    it('maps invalid query length, bibleId, and pageSize to invalid-parameter without fetching', async () => {
      const cases = [
        { query: '', bibleId: 111 },
        { query: 'a'.repeat(101), bibleId: 111 },
        { query: 'love', bibleId: 0 },
        { query: 'love', bibleId: -1 },
        { query: 'love', bibleId: 111, pageSize: 0 },
        { query: 'love', bibleId: 111, pageSize: 100 },
      ]

      for (const params of cases) {
        const result = await api().verses(params)
        expect(result.ok).toBe(false)
        if (result.ok) return
        expect(result.error.kind).toBe('invalid-parameter')
      }
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns auth failure for 401 and 403 without throwing', async () => {
      mockFetch.mockResolvedValue(errorResponse(401))
      const unauthorized = await api().verses({ query: 'love', bibleId: 111 })
      expect(unauthorized.ok).toBe(false)
      if (unauthorized.ok) return
      expect(unauthorized.error).toMatchObject({ kind: 'auth', status: 401 })

      mockFetch.mockResolvedValue(errorResponse(403))
      const forbidden = await api().verses({ query: 'love', bibleId: 111 })
      expect(forbidden.ok).toBe(false)
      if (forbidden.ok) return
      expect(forbidden.error).toMatchObject({ kind: 'auth', status: 403 })
    })

    it('returns transient failure for a 404, which means the Bible is unavailable', async () => {
      mockFetch.mockResolvedValue(errorResponse(404))

      const missingBible = await api().verses({ query: 'zzzznotaword', bibleId: 111 })

      expect(missingBible).toEqual({
        ok: false,
        error: {
          kind: 'transient',
          status: 404,
          message: 'HTTP error! status: 404',
        },
      })
    })

    it('returns transient failure for 5xx, bad JSON, and network errors', async () => {
      mockFetch.mockResolvedValue(errorResponse(500))
      const serverError = await api().verses({ query: 'love', bibleId: 111 })
      expect(serverError.ok).toBe(false)
      if (serverError.ok) return
      expect(serverError.error).toMatchObject({ kind: 'transient', status: 500 })

      mockFetch.mockResolvedValue(jsonResponse({ verses: [{ unexpected: true }] }))
      const badPayload = await api().verses({ query: 'love', bibleId: 111 })
      expect(badPayload.ok).toBe(false)
      if (badPayload.ok) return
      expect(badPayload.error.kind).toBe('transient')
      expect(badPayload.error.message).toMatch(/Unexpected search-verses API response/)

      mockFetch.mockRejectedValue(new TypeError('Network request failed'))
      const networkError = await api().verses({ query: 'love', bibleId: 111 })
      expect(networkError.ok).toBe(false)
      if (networkError.ok) return
      expect(networkError.error.kind).toBe('transient')
      if (networkError.error.kind !== 'transient') return
      expect(networkError.error.status).toBeUndefined()
    })
  })

  describe('topics', () => {
    it('GETs search-topics and maps camelCase results', async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          topics: [
            { id: 42, text: 'Faith', subtopics: ['trust', 'belief'] },
            { id: null, text: 'Love', subtopics: [] },
          ],
          did_you_mean: ['faith'],
          search_instead_for: 'faith',
          total_size: 2,
        }),
      )

      const result = await api().topics({ query: 'faif', languageRanges: ['en-US', '*'] })

      expect(result).toEqual({
        ok: true,
        value: {
          topics: [
            { id: 42, text: 'Faith', subtopics: ['trust', 'belief'] },
            { id: null, text: 'Love', subtopics: [] },
          ],
          didYouMean: ['faith'],
          searchInsteadFor: 'faith',
          totalSize: 2,
        },
      })

      const { url } = lastRequest()
      expect(url.origin + url.pathname).toBe('https://api.example.com/v1/search-topics')
      expect(url.searchParams.get('query')).toBe('faif')
      expect(url.searchParams.getAll('language_ranges[]')).toEqual(['en-us', '*'])
    })

    it('maps empty, overlong, or badly ranged topic searches to invalid-parameter without fetching', async () => {
      const emptyQuery = await api().topics({ query: '', languageRanges: ['en'] })
      expect(emptyQuery.ok).toBe(false)
      if (emptyQuery.ok) return
      expect(emptyQuery.error.kind).toBe('invalid-parameter')

      const longQuery = await api().topics({ query: 'a'.repeat(101), languageRanges: ['en'] })
      expect(longQuery.ok).toBe(false)
      if (longQuery.ok) return
      expect(longQuery.error.kind).toBe('invalid-parameter')

      const emptyRanges = await api().topics({ query: 'love', languageRanges: [] })
      expect(emptyRanges.ok).toBe(false)
      if (emptyRanges.ok) return
      expect(emptyRanges.error.kind).toBe('invalid-parameter')

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
