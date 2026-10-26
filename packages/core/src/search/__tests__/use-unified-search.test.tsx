import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import type { YouVersionImageSearchResult } from '../../index'
import { YouVersionContext } from '../../youversion-context'
import {
  useUnifiedSearch,
  type UseUnifiedSearchOptions,
  type UseUnifiedSearchProps,
  type UseUnifiedSearchResult,
} from '../use-unified-search'

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <YouVersionContext.Provider
      value={{
        appKey: 'appkey',
        apiHost: 'api.example.com',
        installationId: 'inst-1',
        fetchBibleContent: jest.fn(),
      }}
    >
      {children}
    </YouVersionContext.Provider>
  )
}

type UnifiedWire = {
  verses?: { reference: string }[]
  topics?: { id?: number | null; text: string; subtopics: string[] }[]
  images?: ({ id?: string | number | null; passage_id?: string | number | null } | null)[]
  user_intent?: string | null
  did_you_mean?: string[]
  search_instead_for?: string | null
}

function jsonResponse(body: UnifiedWire, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const loveWire = {
  verses: [{ reference: 'JHN.3.16' }, { reference: 'BAD' }],
  topics: [
    { id: 7, text: 'Love', subtopics: ['charity'] },
    { text: 'missing id', subtopics: [] },
  ],
  images: [
    { id: 'img-1', passage_id: 'JHN.3.16' },
    { id: '', passage_id: 'JHN.3.16' },
    { id: 'img-2', passage_id: 'not-usfm' },
    { id: 1, passage_id: 'JHN.3.16' },
    null,
  ],
  user_intent: 'topical',
  did_you_mean: ['love'],
}

const loveSnapshot = {
  verses: [{ id: 'JHN.3.16' }],
  topics: [{ id: 7, text: 'Love', subtopics: ['charity'] }],
  images: [{ id: 'img-1', passageId: 'JHN.3.16' }],
  userIntent: 'topical',
  didYouMean: ['love'],
  searchInsteadFor: null,
}

const hopeWire = {
  verses: [{ reference: 'ROM.8.28' }],
  topics: [],
  did_you_mean: [],
}

const hopeSnapshot = {
  verses: [{ id: 'ROM.8.28' }],
  topics: [],
  images: [],
  didYouMean: [],
  searchInsteadFor: null,
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => undefined
  const promise = new Promise<Response>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function lastCall() {
  const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  if (call === undefined) {
    throw new Error('expected fetch to have been called')
  }
  const url = new URL(String(call[0]))
  const init: RequestInit = call[1] ?? {}
  return { url, init }
}

function lastUrl(): URL {
  return lastCall().url
}

function header(init: RequestInit, name: string): string | null {
  return new Headers(init.headers).get(name)
}

const ready: UseUnifiedSearchProps = {
  query: 'love',
  bibleId: 111,
  languageRanges: ['en_US', 'es'],
  fields: ['verses', 'topics', 'images', 'verses'],
  userIntent: 'topical',
}

describe('useUnifiedSearch', () => {
  it('throws when used outside YouVersionProvider', () => {
    expect(() => renderHook(() => useUnifiedSearch(ready))).toThrow(
      /useYouVersion must be used inside of YouVersionProvider/,
    )
  })

  it('stays idle and does not fetch until the input can be sent', () => {
    const { result, rerender } = renderHook(
      (props: UseUnifiedSearchProps) => useUnifiedSearch(props),
      {
        wrapper: Wrapper,
        initialProps: { query: '   ', bibleId: 111, languageRanges: ['en'] },
      },
    )

    expect(result.current).toMatchObject({ data: null, loading: false, error: null })

    rerender({ query: 'love', bibleId: 111, languageRanges: [] })
    expect(result.current).toMatchObject({ data: null, loading: false, error: null })

    rerender({ query: 'love', bibleId: 111, languageRanges: ['en'], fields: [] })
    expect(result.current).toMatchObject({ data: null, loading: false, error: null })

    rerender({ query: 'a'.repeat(101), bibleId: 111, languageRanges: ['en'] })
    expect(result.current).toMatchObject({ data: null, loading: false, error: null })

    rerender({ query: 'love', bibleId: 111, languageRanges: ['en--US'] })
    expect(result.current).toMatchObject({ data: null, loading: false, error: null })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('loads one snapshot and maps image hits', async () => {
    const pending = deferredResponse()
    mockFetch.mockReturnValue(pending.promise)

    const { result } = renderHook(() => useUnifiedSearch(ready), { wrapper: Wrapper })

    expect(result.current).toMatchObject({ data: null, loading: true, error: null })

    pending.resolve(jsonResponse(loveWire))
    await waitFor(() => expect(result.current.data).toEqual(loveSnapshot))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()

    const { url, init } = lastCall()
    expect(url.origin + url.pathname).toBe('https://api.example.com/v1/search-unified')
    expect(url.searchParams.get('query')).toBe('love')
    expect(url.searchParams.get('bible_id')).toBe('111')
    expect(url.searchParams.getAll('language_ranges[]')).toEqual(['en-us', 'es'])
    expect(url.searchParams.getAll('fields[]')).toEqual(['verses', 'topics', 'images'])
    expect(url.searchParams.get('user_intent')).toBe('topical')
    expect(url.searchParams.has('page_size')).toBe(false)
    expect(url.searchParams.has('page_token')).toBe(false)
    expect(header(init, 'X-YVP-App-Key')).toBe('appkey')
    expect(header(init, 'X-YVP-Installation-Id')).toBe('inst-1')
  })

  it('keeps the previous snapshot while the next query loads', async () => {
    const pending = deferredResponse()
    mockFetch
      .mockResolvedValueOnce(jsonResponse(loveWire))
      .mockReturnValueOnce(pending.promise)

    const { result, rerender } = renderHook(
      (props: UseUnifiedSearchProps) => useUnifiedSearch(props),
      { wrapper: Wrapper, initialProps: ready },
    )
    await waitFor(() => expect(result.current.data).toEqual(loveSnapshot))

    rerender({ ...ready, query: 'hope' })
    expect(result.current.data).toEqual(loveSnapshot)
    expect(result.current.loading).toBe(true)
    expect(lastUrl().searchParams.get('query')).toBe('hope')

    pending.resolve(jsonResponse(hopeWire))
    await waitFor(() => expect(result.current.data).toEqual(hopeSnapshot))
    expect(result.current.loading).toBe(false)
  })

  it('drops the previous snapshot when keepPreviousData is false', async () => {
    const pending = deferredResponse()
    mockFetch
      .mockResolvedValueOnce(jsonResponse(loveWire))
      .mockReturnValueOnce(pending.promise)

    const { result, rerender } = renderHook(
      (props: UseUnifiedSearchProps) =>
        useUnifiedSearch(props, { keepPreviousData: false }),
      { wrapper: Wrapper, initialProps: ready },
    )
    await waitFor(() => expect(result.current.data).toEqual(loveSnapshot))

    rerender({ ...ready, bibleId: 112 })
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)

    pending.resolve(jsonResponse(hopeWire))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(hopeSnapshot)
    expect(lastUrl().searchParams.get('bible_id')).toBe('112')
  })

  it('does not fetch while enabled is false', async () => {
    mockFetch.mockResolvedValue(jsonResponse(loveWire))
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useUnifiedSearch(ready, { enabled }),
      { wrapper: Wrapper, initialProps: { enabled: false } },
    )

    expect(result.current).toMatchObject({ data: null, loading: false, error: null })
    expect(mockFetch).not.toHaveBeenCalled()

    rerender({ enabled: true })
    await waitFor(() => expect(result.current.data).toEqual(loveSnapshot))
  })

  it('clears the snapshot when the query is no longer ready', async () => {
    mockFetch.mockResolvedValue(jsonResponse(loveWire))
    const { result, rerender } = renderHook(
      (props: UseUnifiedSearchProps) => useUnifiedSearch(props),
      { wrapper: Wrapper, initialProps: ready },
    )
    await waitFor(() => expect(result.current.data).toEqual(loveSnapshot))
    const calls = mockFetch.mock.calls.length

    rerender({ ...ready, query: '   ' })
    expect(result.current).toMatchObject({ data: null, loading: false, error: null })
    expect(mockFetch.mock.calls.length).toBe(calls)
  })

  it('reports a search error and clears it on refetch', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(loveWire))
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(jsonResponse(loveWire))

    const { result } = renderHook(() => useUnifiedSearch(ready), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.data).toEqual(loveSnapshot))

    act(() => result.current.refetch())
    await waitFor(() => expect(result.current.error).toMatchObject({ kind: 'auth', status: 401 }))
    expect(result.current.data).toEqual(loveSnapshot)
    expect(result.current.loading).toBe(false)

    act(() => result.current.refetch())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.error).toBeNull())
    expect(result.current.data).toEqual(loveSnapshot)
    expect(result.current.loading).toBe(false)
  })

  it('returns the hook override and does not fetch', () => {
    const snapshot: UseUnifiedSearchResult = {
      data: {
        verses: [],
        topics: [],
        images: [],
        didYouMean: ['override'],
        searchInsteadFor: null,
      },
      loading: false,
      error: null,
      refetch() {},
    }
    const options: UseUnifiedSearchOptions = { enabled: true }
    const override = jest.fn(() => snapshot)
    const { result } = renderHook(() => useUnifiedSearch(ready, options), {
      wrapper: ({ children }) => (
        <YouVersionContext.Provider
          value={{
            appKey: 'appkey',
            apiHost: 'api.example.com',
            installationId: 'inst-1',
            fetchBibleContent: jest.fn(),
            hookOverrides: { useUnifiedSearch: override },
          }}
        >
          {children}
        </YouVersionContext.Provider>
      ),
    })

    expect(result.current).toBe(snapshot)
    expect(override).toHaveBeenCalledWith(ready, options)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('reads an image-only response', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ images: [{ id: 'art-2', passage_id: 'PSA.23.1' }] }),
    )
    const { result } = renderHook(
      () =>
        useUnifiedSearch({
          query: 'peace',
          bibleId: 111,
          languageRanges: 'en',
          fields: ['images'],
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.data).toEqual({
      verses: [],
      topics: [],
      images: [{ id: 'art-2', passageId: 'PSA.23.1' }],
      didYouMean: [],
      searchInsteadFor: null,
    })
    const url = lastUrl()
    expect(url.searchParams.getAll('fields[]')).toEqual(['images'])
    expect(url.searchParams.has('user_intent')).toBe(false)
  })

  it('fills empty lists when a response omits images', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ verses: [{ reference: 'ROM.8.28' }] }))
    const { result } = renderHook(
      () => useUnifiedSearch({ query: 'hope', bibleId: 111, languageRanges: ['en'] }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.data).toEqual(hopeSnapshot))
    const url = lastUrl()
    expect(url.searchParams.has('fields[]')).toBe(false)
    expect(url.searchParams.has('user_intent')).toBe(false)
  })

  it('keeps an opaque image id, a passage range, and a newer response intent', async () => {
    const ranges: readonly string[] = ['EN_us', 'es', '*']
    mockFetch.mockResolvedValue(
      jsonResponse({
        verses: [{ reference: 'bad-reference' }],
        topics: [{ id: null, text: 'Love', subtopics: ['grace'] }],
        images: [
          { id: 'opaque+/=id', passage_id: '1CO.13.4-7' },
          { id: '', passage_id: 'JHN.3.16' },
          { id: 'drop-me', passage_id: 'not-usfm' },
        ],
        user_intent: 'future-intent',
        did_you_mean: ['love'],
        search_instead_for: 'love',
      }),
    )
    const { result } = renderHook(
      () =>
        useUnifiedSearch({
          query: ' love & hope ',
          bibleId: 111,
          languageRanges: ranges,
          fields: ['images', 'verses', 'topics', 'images'],
          userIntent: 'topical',
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    const image: YouVersionImageSearchResult | undefined = result.current.data?.images[0]
    expect(image).toEqual({ id: 'opaque+/=id', passageId: '1CO.13.4-7' })
    expect(result.current.data).toEqual({
      verses: [],
      topics: [{ id: null, text: 'Love', subtopics: ['grace'] }],
      images: [{ id: 'opaque+/=id', passageId: '1CO.13.4-7' }],
      userIntent: 'future-intent',
      didYouMean: ['love'],
      searchInsteadFor: 'love',
    })
    const url = lastUrl()
    expect(url.searchParams.get('query')).toBe('love & hope')
    expect(url.searchParams.getAll('language_ranges[]')).toEqual(['en-us', 'es', '*'])
    expect(url.searchParams.getAll('fields[]')).toEqual(['images', 'verses', 'topics'])
    expect(url.searchParams.get('user_intent')).toBe('topical')
  })

  it('reports invalid-parameter for a bible id of 0 and does not fetch', async () => {
    const { result } = renderHook(() => useUnifiedSearch({ ...ready, bibleId: 0 }), {
      wrapper: Wrapper,
    })

    await waitFor(() => expect(result.current.error?.kind).toBe('invalid-parameter'))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('reports invalid-parameter for an unknown field and does not fetch', async () => {
    const { result } = renderHook(
      () =>
        useUnifiedSearch({
          ...ready,
          // @ts-expect-error — videos is not a unified search field
          fields: ['videos'],
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.error?.kind).toBe('invalid-parameter'))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('reports invalid-parameter for an unknown request intent and does not fetch', async () => {
    const { result } = renderHook(
      () =>
        useUnifiedSearch({
          ...ready,
          // @ts-expect-error — future-intent is not a request intent
          userIntent: 'future-intent',
        }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.error?.kind).toBe('invalid-parameter'))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it.each<[number, 'auth' | 'transient']>([
    [401, 'auth'],
    [403, 'auth'],
    [400, 'transient'],
    [404, 'transient'],
    [429, 'transient'],
    [500, 'transient'],
  ])('maps HTTP %s to %s', async (status, kind) => {
    mockFetch.mockResolvedValue(new Response('', { status }))
    const { result } = renderHook(() => useUnifiedSearch(ready), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.error).toMatchObject({ kind, status }))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('maps a malformed body and a transport failure to transient', async () => {
    mockFetch.mockResolvedValue(
      new Response('{"images":"not-an-array"}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    const { result, unmount } = renderHook(() => useUnifiedSearch(ready), { wrapper: Wrapper })

    await waitFor(() => expect(result.current.error?.kind).toBe('transient'))
    expect(result.current.error?.message).toMatch(/Unexpected search-unified API response/)
    expect(result.current.data).toBeNull()
    unmount()

    mockFetch.mockRejectedValue(new TypeError('Network request failed'))
    const network = renderHook(() => useUnifiedSearch(ready), { wrapper: Wrapper })
    await waitFor(() => expect(network.result.current.error?.kind).toBe('transient'))
    expect(network.result.current.error).toEqual({
      kind: 'transient',
      message: 'Network request failed',
    })
    expect(network.result.current.data).toBeNull()
  })

  it('drops the previous snapshot when the installation id changes', async () => {
    const provider = {
      appKey: 'appkey',
      apiHost: 'api.example.com',
      installationId: 'inst-1',
    }
    function DynamicWrapper({ children }: { children: ReactNode }) {
      return (
        <YouVersionContext.Provider value={{ ...provider, fetchBibleContent: jest.fn() }}>
          {children}
        </YouVersionContext.Provider>
      )
    }

    const pending = deferredResponse()
    mockFetch.mockResolvedValueOnce(jsonResponse(loveWire)).mockReturnValueOnce(pending.promise)
    const { result, rerender } = renderHook(
      (_renderPass: number) => useUnifiedSearch(ready),
      { wrapper: DynamicWrapper, initialProps: 0 },
    )
    await waitFor(() => expect(result.current.data).toEqual(loveSnapshot))

    provider.installationId = 'inst-2'
    rerender(1)

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
    expect(result.current.error).toBeNull()
    const { url, init } = lastCall()
    expect(url.origin).toBe('https://api.example.com')
    expect(header(init, 'X-YVP-Installation-Id')).toBe('inst-2')

    pending.resolve(jsonResponse(hopeWire))
    await waitFor(() => expect(result.current.data).toEqual(hopeSnapshot))
    expect(result.current.loading).toBe(false)
  })

  it('does not keep another host snapshot when that request fails', async () => {
    const provider = {
      appKey: 'appkey',
      apiHost: 'api.example.com',
      installationId: 'inst-1',
    }
    function DynamicWrapper({ children }: { children: ReactNode }) {
      return (
        <YouVersionContext.Provider value={{ ...provider, fetchBibleContent: jest.fn() }}>
          {children}
        </YouVersionContext.Provider>
      )
    }

    mockFetch.mockResolvedValueOnce(jsonResponse(loveWire))
    const { result, rerender } = renderHook(
      (_renderPass: number) => useUnifiedSearch(ready, { keepPreviousData: false }),
      { wrapper: DynamicWrapper, initialProps: 0 },
    )
    await waitFor(() => expect(result.current.data).toEqual(loveSnapshot))

    const pending = deferredResponse()
    mockFetch.mockReturnValueOnce(pending.promise)
    provider.apiHost = 'other.example.com'
    provider.appKey = 'other-key'
    rerender(1)

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(true)
    const { url, init } = lastCall()
    expect(url.origin).toBe('https://other.example.com')
    expect(header(init, 'X-YVP-App-Key')).toBe('other-key')

    pending.resolve(new Response('', { status: 500 }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(result.current.error).toMatchObject({ kind: 'transient', status: 500 })
  })
})
