import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { YouVersionContext } from '../../youversion-context'
import {
  useUnifiedSearch,
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

function lastUrl(): URL {
  const call = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
  if (call === undefined) {
    throw new Error('expected fetch to have been called')
  }
  return new URL(String(call[0]))
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

    const url = lastUrl()
    expect(url.origin + url.pathname).toBe('https://api.example.com/v1/search-unified')
    expect(url.searchParams.get('query')).toBe('love')
    expect(url.searchParams.get('bible_id')).toBe('111')
    expect(url.searchParams.getAll('language_ranges[]')).toEqual(['en-us', 'es'])
    expect(url.searchParams.getAll('fields[]')).toEqual(['verses', 'topics', 'images'])
    expect(url.searchParams.get('user_intent')).toBe('topical')
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
    const { result } = renderHook(() => useUnifiedSearch(ready), {
      wrapper: ({ children }) => (
        <YouVersionContext.Provider
          value={{
            appKey: 'appkey',
            apiHost: 'api.example.com',
            installationId: 'inst-1',
            fetchBibleContent: jest.fn(),
            hookOverrides: { useUnifiedSearch: () => snapshot },
          }}
        >
          {children}
        </YouVersionContext.Provider>
      ),
    })

    expect(result.current).toBe(snapshot)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
