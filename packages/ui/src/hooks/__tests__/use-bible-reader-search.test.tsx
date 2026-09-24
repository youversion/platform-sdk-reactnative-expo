import type {
  FetchBibleContent,
  SearchApiResult,
  UseSearchResult,
  YouVersionSearchQueries,
  YouVersionVerseSearchResults,
} from '@youversion/platform-react-native-expo-core'
import { act, renderHook } from '@testing-library/react-native'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { SEARCH_DEBOUNCE_MS } from '../../lib/bible-reader-search'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import {
  searchHistoryStoreInitialState,
  useSearchHistoryStore,
} from '../../stores/search-history-store'
import { useBibleReaderSearch } from '../use-bible-reader-search'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function okQueries(texts: string[]): SearchApiResult<YouVersionSearchQueries> {
  return { ok: true, value: { queries: texts.map((text) => ({ text })) } }
}

function okVerses(
  usfms: string[],
  nextPageToken?: string | null,
): SearchApiResult<YouVersionVerseSearchResults> {
  return {
    ok: true,
    value: {
      verses: usfms.map((id) => ({ id })),
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

function fetchStub(
  body = '{"content":"For God so loved","reference":"John 3:16"}',
): FetchBibleContent {
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

async function resetSearchHistoryStore() {
  mmkvStorage.clearAll()
  useSearchHistoryStore.setState(searchHistoryStoreInitialState)
  await useSearchHistoryStore.persist.rehydrate()
}

describe('useBibleReaderSearch', () => {
  beforeEach(() => {
    return resetSearchHistoryStore()
  })

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
    expect(result.current.view.phase).toBe('browsing')

    rerender({ isOpen: true })
    await flush()

    expect(stub.trendingQueries).toHaveBeenCalledWith({ languageRanges: ['en'] })
    expect(result.current.query).toBe('')
    expect(result.current.view).toEqual({
      phase: 'browsing',
      trending: { status: 'done', value: ['faith'] },
      recents: [],
    })
    expect(result.current.scrollGeneration).toBe(1)
  })

  it('does not call suggestedQueries during the debounce window', async () => {
    jest.useFakeTimers()
    const pending = deferred<SearchApiResult<YouVersionSearchQueries>>()
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

    expect(result.current.view).toEqual({
      phase: 'suggesting',
      suggestions: [],
      loading: false,
    })
    expect(stub.suggestedQueries).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1)
    })
    expect(stub.suggestedQueries).not.toHaveBeenCalled()
    expect(result.current.view).toEqual({
      phase: 'suggesting',
      suggestions: [],
      loading: false,
    })

    act(() => {
      jest.advanceTimersByTime(1)
    })
    expect(stub.suggestedQueries).toHaveBeenCalledWith({
      query: 'love',
      languageRanges: ['en'],
    })
    expect(result.current.view).toEqual({
      phase: 'suggesting',
      suggestions: [],
      loading: true,
    })

    await act(async () => {
      pending.resolve(okQueries(['love one another']))
    })
    await flush()
    expect(result.current.view).toEqual({
      phase: 'suggesting',
      suggestions: ['love one another'],
      loading: false,
    })
  })

  it('clears trending as soon as the query changes', async () => {
    const stub = searchStub()
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
    expect(result.current.view.phase).toBe('browsing')

    act(() => {
      result.current.setQuery('love')
    })

    expect(result.current.view).toEqual({
      phase: 'suggesting',
      suggestions: [],
      loading: false,
    })
    expect(stub.suggestedQueries).not.toHaveBeenCalled()
  })

  it('reloads trending when the version language arrives after open', async () => {
    const stub = searchStub()
    const { rerender } = renderHook(
      ({ languageRanges }: { languageRanges: readonly string[] }) =>
        useBibleReaderSearch({
          versionId: 111,
          isOpen: true,
          fetchBibleContent: fetchStub(),
          languageRanges,
        }),
      { wrapper: wrapperFor(stub), initialProps: { languageRanges: ['*'] } },
    )
    await flush()
    expect(stub.trendingQueries).toHaveBeenCalledWith({ languageRanges: ['*'] })

    rerender({ languageRanges: ['es'] })
    await flush()

    expect(stub.trendingQueries).toHaveBeenLastCalledWith({ languageRanges: ['es'] })
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
    expect(result.current.view.phase).toBe('results')
    if (result.current.view.phase === 'results') {
      expect(result.current.view.verses[0]?.usfm).toBe('JHN.3.16')
      expect(result.current.view.verses[0]?.title).toBe('John 3:16')
    }
  })

  it('keeps a trailing space typed onto a submitted query', async () => {
    jest.useFakeTimers()
    const pending = deferred<SearchApiResult<YouVersionSearchQueries>>()
    const stub = searchStub({
      verses: jest.fn(async () => okVerses(['JHN.3.16'])),
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

    await act(async () => {
      result.current.submit('love')
    })
    await flush()

    act(() => {
      result.current.setQuery('love ')
    })

    expect(result.current.query).toBe('love ')
    expect(result.current.view).toEqual({
      phase: 'suggesting',
      suggestions: [],
      loading: false,
    })

    act(() => {
      jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    })

    expect(stub.suggestedQueries).toHaveBeenCalledWith({
      query: 'love',
      languageRanges: ['en'],
    })
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
    expect(result.current.view.phase).toBe('browsing')
  })

  it('submits a suggestion as the search query and stays pending until titled', async () => {
    const passage = deferred<{ status: number; body: string; contentType: string | null }>()
    const fetchBibleContent = jest.fn(async () => passage.promise)
    const stub = searchStub({
      verses: jest.fn(async () => okVerses(['ROM.8.28'])),
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
      result.current.submit('hope')
    })
    await flush()

    expect(stub.verses).toHaveBeenCalledWith({
      query: 'hope',
      bibleId: 111,
      userIntent: 'unknown',
    })
    expect(result.current.query).toBe('hope')
    expect(result.current.view.phase).toBe('pending')

    await act(async () => {
      passage.resolve({
        status: 200,
        body: '{"content":"And we know","reference":"Romans 8:28"}',
        contentType: 'application/json',
      })
    })
    await flush()

    expect(result.current.view.phase).toBe('results')
    if (result.current.view.phase === 'results') {
      expect(result.current.view.verses).toEqual([
        { usfm: 'ROM.8.28', title: 'Romans 8:28', snippet: 'And we know' },
      ])
    }
  })

  it('does not search again for the same query and Bible version', async () => {
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
    expect(result.current.view.phase).toBe('results')
    expect(stub.verses).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.submit('hope')
    })
    await flush()

    expect(stub.verses).toHaveBeenCalledTimes(1)
    expect(result.current.view.phase).toBe('results')
  })

  it('does not search again after a whitespace-only edit of the same query', async () => {
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
    expect(stub.verses).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.setQuery('hope ')
    })
    await act(async () => {
      result.current.submit('hope ')
    })
    await flush()

    expect(stub.verses).toHaveBeenCalledTimes(1)
    expect(result.current.query).toBe('hope ')
  })

  it('records recents on submit even when verses fail', async () => {
    const stub = searchStub({
      verses: jest.fn(async () => ({
        ok: false as const,
        error: { kind: 'transient' as const, message: 'offline' },
      })),
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

    expect(result.current.view.phase).toBe('failed')
    expect(useSearchHistoryStore.getState().entries).toEqual(['hope'])
  })

  it('treats zero API hits as empty', async () => {
    const stub = searchStub({
      verses: jest.fn(async () => okVerses([])),
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
      result.current.submit('zzzz')
    })
    await flush()

    expect(result.current.view.phase).toBe('empty')
  })

  it('treats all-failed enrichment as failed, not empty', async () => {
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

    expect(result.current.view.phase).toBe('failed')
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
    expect(result.current.view.phase).toBe('results')

    act(() => {
      if (result.current.view.phase === 'results') {
        result.current.view.onEndReached()
      }
    })
    act(() => {
      if (result.current.view.phase === 'results') {
        result.current.view.onEndReached()
      }
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
    expect(result.current.view.phase).toBe('pending')

    await act(async () => {
      secondSearch.resolve(okVerses(['ISA.26.3']))
    })
    await flush()

    expect(result.current.view.phase).toBe('results')
    if (result.current.view.phase === 'results') {
      expect(result.current.view.verses[0]?.usfm).toBe('ISA.26.3')
    }
  })

  it('keeps existing titled rows when pagination fails', async () => {
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
      if (result.current.view.phase === 'results') {
        result.current.view.onEndReached()
      }
    })
    await flush()

    expect(result.current.view.phase).toBe('results')
    if (result.current.view.phase === 'results') {
      expect(result.current.view.verses[0]?.usfm).toBe('JHN.3.16')
      expect(result.current.view.verses[0]?.title).toBe('John 3:16')
      expect(result.current.view.footer.kind).toBe('error')
    }
  })

  it('keeps page one and retries when a later page cannot be titled', async () => {
    const verses = jest
      .fn()
      .mockResolvedValueOnce(okVerses(['JHN.3.16'], 'page-2'))
      .mockResolvedValueOnce(okVerses(['PSA.23.1'], 'page-3'))
      .mockResolvedValueOnce(okVerses(['PSA.23.1'], 'page-3'))
    const fetchBibleContent = jest.fn(async (request: { path: string }) => {
      if (request.path.includes('PSA.23.1')) {
        throw new Error('offline')
      }
      return {
        status: 200,
        body: '{"content":"For God so loved","reference":"John 3:16"}',
        contentType: 'application/json',
      }
    })
    const { result } = renderHook(
      () =>
        useBibleReaderSearch({
          versionId: 111,
          isOpen: true,
          fetchBibleContent,
          languageRanges: ['en'],
        }),
      { wrapper: wrapperFor(searchStub({ verses })) },
    )
    await flush()

    await act(async () => {
      result.current.submit('love')
    })
    await flush()

    await act(async () => {
      if (result.current.view.phase === 'results') {
        result.current.view.onEndReached()
      }
    })
    await flush()

    expect(result.current.view.phase).toBe('results')
    if (result.current.view.phase !== 'results') {
      return
    }
    expect(result.current.view.verses.map((verse) => verse.usfm)).toEqual(['JHN.3.16'])
    expect(result.current.view.footer.kind).toBe('error')

    fetchBibleContent.mockImplementation(async () => ({
      status: 200,
      body: '{"content":"The Lord is my shepherd","reference":"Psalm 23:1"}',
      contentType: 'application/json',
    }))

    await act(async () => {
      const { view } = result.current
      if (view.phase === 'results' && view.footer.kind === 'error') {
        view.footer.onRetry()
      }
    })
    await flush()

    expect(verses).toHaveBeenCalledTimes(3)
    expect(result.current.view.phase).toBe('results')
    if (result.current.view.phase === 'results') {
      expect(result.current.view.verses.map((verse) => verse.usfm)).toEqual(['JHN.3.16', 'PSA.23.1'])
      expect(result.current.view.footer.kind).toBe('none')
    }
  })

  it('does not request another page when nextPageToken is null', async () => {
    const verses = jest.fn(async () => okVerses(['JHN.3.16'], null))
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

    act(() => {
      if (result.current.view.phase === 'results') {
        result.current.view.onEndReached()
      }
    })

    expect(verses).toHaveBeenCalledTimes(1)
    if (result.current.view.phase === 'results') {
      expect(result.current.view.verses[0]?.usfm).toBe('JHN.3.16')
    }
  })

  it('drops a stale snippet from an earlier search', async () => {
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

    expect(result.current.view.phase).toBe('results')
    if (result.current.view.phase === 'results') {
      expect(result.current.view.verses).toEqual([
        { usfm: 'PSA.23.1', title: 'Psalm 23:1', snippet: 'The Lord is my shepherd' },
      ])
    }
  })
})
