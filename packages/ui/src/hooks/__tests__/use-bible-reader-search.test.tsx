import type {
  FetchBibleContent,
  SearchApiResult,
  UseSearchResult,
  YouVersionSearchQuery,
  YouVersionVerseSearchResults,
} from '@youversion/platform-react-native-expo-core'
import { act, renderHook } from '@testing-library/react-native'

import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { SEARCH_DEBOUNCE_MS } from '../../lib/bible-reader-search'
import { useBibleReaderSearch } from '../use-bible-reader-search'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function okQueries(texts: string[]): SearchApiResult<YouVersionSearchQuery[]> {
  return { ok: true, value: texts.map((text) => ({ text })) }
}

function okVerses(
  usfms: string[],
  nextPageToken?: string,
): SearchApiResult<YouVersionVerseSearchResults> {
  return {
    ok: true,
    value: {
      verses: usfms.map((reference) => ({ reference })),
      didYouMean: [],
      nextPageToken,
    },
  }
}

function searchStub(overrides: Partial<UseSearchResult> = {}): UseSearchResult {
  return {
    suggestedQueries: jest.fn(async () => okQueries([])),
    trendingQueries: jest.fn(async () => okQueries(['faith'])),
    verses: jest.fn(async () => okVerses([])),
    topics: jest.fn(async () => ({
      ok: true as const,
      value: { topics: [], didYouMean: [], totalSize: 0 },
    })),
    ...overrides,
  }
}

function fetchStub(body = '{"content":"For God so loved","reference":"John 3:16"}'): FetchBibleContent {
  return jest.fn(async () => ({
    status: 200,
    body,
    contentType: 'application/json',
  }))
}

function wrapperFor(stub: UseSearchResult) {
  return youVersionProviderWrapper('light', 'en', { useSearch: () => stub })
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useBibleReaderSearch', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('resets and loads trending when the sheet opens', async () => {
    const stub = searchStub()
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useBibleReaderSearch({
          versionId: 111,
          isOpen,
          fetchBibleContent: fetchStub(),
          languageRanges: ['en'],
        }),
      { wrapper: wrapperFor(stub), initialProps: { isOpen: false } },
    )

    expect(stub.trendingQueries).not.toHaveBeenCalled()

    rerender({ isOpen: true })
    await flush()

    expect(stub.trendingQueries).toHaveBeenCalledWith({ languageRanges: ['en'] })
    expect(result.current.query).toBe('')
    expect(result.current.verses).toEqual([])
    expect(result.current.suggestions).toEqual([{ text: 'faith' }])
    expect(result.current.scrollGeneration).toBe(1)
  })

  it('does not show suggestion progress during the debounce window', async () => {
    jest.useFakeTimers()
    const pending = deferred<SearchApiResult<YouVersionSearchQuery[]>>()
    const stub = searchStub({
      suggestedQueries: jest.fn(async () => pending.promise),
    })
    const { result } = renderHook(
      () =>
        useBibleReaderSearch({
          versionId: 111,
          isOpen: true,
          fetchBibleContent: fetchStub(),
          languageRanges: ['en'],
        }),
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    act(() => {
      result.current.setQuery('love')
    })

    expect(result.current.isLoadingSuggestions).toBe(false)
    expect(stub.suggestedQueries).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
    })
    expect(stub.suggestedQueries).not.toHaveBeenCalled()
    expect(result.current.isLoadingSuggestions).toBe(false)

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(result.current.isLoadingSuggestions).toBe(true)
    expect(stub.suggestedQueries).toHaveBeenCalledWith({
      query: 'love',
      languageRanges: ['en'],
    })

    await act(async () => {
      pending.resolve(okQueries(['love one another']))
    })
    await flush()
    expect(result.current.isLoadingSuggestions).toBe(false)
  })

  it('skips suggestions for the query that was just submitted', async () => {
    jest.useFakeTimers()
    const stub = searchStub({
      verses: jest.fn(async () => okVerses(['JHN.3.16'])),
      suggestedQueries: jest.fn(async () => okQueries(['love one another'])),
    })
    const { result } = renderHook(
      () =>
        useBibleReaderSearch({
          versionId: 111,
          isOpen: true,
          fetchBibleContent: fetchStub(),
          languageRanges: ['en'],
        }),
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      result.current.submit('love')
    })
    await flush()

    act(() => {
      result.current.setQuery('love')
    })
    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    })

    expect(stub.suggestedQueries).not.toHaveBeenCalled()
    expect(result.current.showingResults).toBe(true)
    expect(result.current.verses[0]?.usfm).toBe('JHN.3.16')
  })

  it('clears whitespace without requesting verses or suggestions', async () => {
    const trendingQueries = jest.fn(async () => okQueries(['faith']))
    const stub = searchStub({ trendingQueries })
    const { result } = renderHook(
      () =>
        useBibleReaderSearch({
          versionId: 111,
          isOpen: true,
          fetchBibleContent: fetchStub(),
          languageRanges: ['en'],
        }),
      { wrapper: wrapperFor(stub) },
    )
    await flush()
    trendingQueries.mockClear()

    act(() => {
      result.current.setQuery('   ')
    })
    await flush()

    expect(stub.verses).not.toHaveBeenCalled()
    expect(stub.suggestedQueries).not.toHaveBeenCalled()
    expect(stub.trendingQueries).toHaveBeenCalledTimes(1)
    expect(result.current.query).toBe('   ')
    expect(result.current.showingResults).toBe(false)
  })

  it('submits a suggestion as the search query', async () => {
    const stub = searchStub({
      verses: jest.fn(async () => okVerses(['ROM.8.28'])),
    })
    const { result } = renderHook(
      () =>
        useBibleReaderSearch({
          versionId: 111,
          isOpen: true,
          fetchBibleContent: fetchStub(),
          languageRanges: ['en'],
        }),
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      result.current.submit('hope')
    })
    await flush()

    expect(stub.verses).toHaveBeenCalledWith({
      query: 'hope',
      bibleId: 111,
      userIntent: 'unknown',
    })
    expect(result.current.query).toBe('hope')
    expect(result.current.verses[0]?.usfm).toBe('ROM.8.28')
  })

  it('keeps results when a page fails and rejects a stale page', async () => {
    const firstPage = deferred<SearchApiResult<YouVersionVerseSearchResults>>()
    const secondSearch = deferred<SearchApiResult<YouVersionVerseSearchResults>>()
    const verses = jest
      .fn()
      .mockImplementationOnce(async () => okVerses(['JHN.3.16'], 'page-2'))
      .mockImplementationOnce(async () => firstPage.promise)
      .mockImplementationOnce(async () => secondSearch.promise)
    const stub = searchStub({ verses })
    const { result } = renderHook(
      () =>
        useBibleReaderSearch({
          versionId: 111,
          isOpen: true,
          fetchBibleContent: fetchStub(),
          languageRanges: ['en'],
        }),
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      result.current.submit('love')
    })
    await flush()
    expect(result.current.verses).toHaveLength(1)

    act(() => {
      result.current.loadNextPage()
    })
    act(() => {
      result.current.loadNextPage()
    })
    expect(verses).toHaveBeenCalledTimes(2)

    await act(async () => {
      result.current.submit('peace')
    })

    await act(async () => {
      firstPage.resolve({ ok: false, error: { kind: 'transient', message: 'page failed' } })
      await firstPage.promise.catch(() => undefined)
    })
    await flush()

    expect(result.current.query).toBe('peace')
    expect(result.current.verses).toEqual([])

    await act(async () => {
      secondSearch.resolve(okVerses(['ISA.26.3']))
    })
    await flush()

    expect(result.current.verses[0]?.usfm).toBe('ISA.26.3')
  })

  it('keeps existing rows when pagination fails', async () => {
    const stub = searchStub({
      verses: jest
        .fn()
        .mockResolvedValueOnce(okVerses(['JHN.3.16'], 'page-2'))
        .mockResolvedValueOnce({ ok: false, error: { kind: 'transient', message: 'page failed' } }),
    })
    const { result } = renderHook(
      () =>
        useBibleReaderSearch({
          versionId: 111,
          isOpen: true,
          fetchBibleContent: fetchStub(),
          languageRanges: ['en'],
        }),
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      result.current.submit('love')
    })
    await flush()

    await act(async () => {
      result.current.loadNextPage()
    })
    await flush()

    expect(result.current.verses[0]?.usfm).toBe('JHN.3.16')
    expect(result.current.pageError?.kind).toBe('transient')
  })

  it('trims enrichment text and drops a stale snippet', async () => {
    const firstText = deferred<{ status: number; body: string; contentType: string | null }>()
    const fetchBibleContent = jest
      .fn<ReturnType<FetchBibleContent>, Parameters<FetchBibleContent>>()
      .mockImplementationOnce(async () => firstText.promise)
      .mockImplementationOnce(async () => ({
        status: 200,
        body: '{"content":"The Lord is my shepherd","reference":"Psalm 23:1"}',
        contentType: 'application/json',
      }))
    const stub = searchStub({
      verses: jest
        .fn()
        .mockResolvedValueOnce(okVerses(['JHN.3.16']))
        .mockResolvedValueOnce(okVerses(['PSA.23.1'])),
    })
    const { result } = renderHook(
      () =>
        useBibleReaderSearch({
          versionId: 111,
          isOpen: true,
          fetchBibleContent,
          languageRanges: ['en'],
        }),
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      result.current.submit('love')
    })
    await flush()

    await act(async () => {
      result.current.submit('shepherd')
    })
    await flush()

    await act(async () => {
      firstText.resolve({
        status: 200,
        body: '{"content":"<p>For God so loved</p>","reference":"John 3:16"}',
        contentType: 'application/json',
      })
    })
    await flush()

    expect(result.current.verses).toEqual([
      { usfm: 'PSA.23.1', title: 'Psalm 23:1', snippet: 'The Lord is my shepherd' },
    ])
  })

  it('keeps a row when enrichment fails', async () => {
    const stub = searchStub({
      verses: jest.fn(async () => okVerses(['JHN.3.16'])),
    })
    const fetchBibleContent = jest.fn(async () => {
      throw new Error('offline')
    })
    const { result } = renderHook(
      () =>
        useBibleReaderSearch({
          versionId: 111,
          isOpen: true,
          fetchBibleContent,
          languageRanges: ['en'],
        }),
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      result.current.submit('love')
    })
    await flush()

    expect(result.current.verses).toEqual([
      { usfm: 'JHN.3.16', title: 'JHN 3:16', snippet: null },
    ])
  })
})
