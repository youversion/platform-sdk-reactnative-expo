import type {
  BibleReference,
  FetchBibleContent,
  SearchApiResult,
  UseSearchResult,
  YouVersionSearchQueries,
} from '@youversion/platform-react-native-expo-core'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable, Text, TextInput, View } from 'react-native'

import { nonBlankQuery } from '../../lib/bible-reader-search'
import {
  searchHistoryStoreInitialState,
  useSearchHistoryStore,
} from '../../stores/search-history-store'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReaderSearchSheet } from '../bible-reader-search-sheet'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

function searchStub(overrides: Partial<UseSearchResult> = {}): UseSearchResult {
  return {
    suggestedQueries: jest.fn(async () => ({ ok: true as const, value: { queries: [] } })),
    trendingQueries: jest.fn(async () => ({
      ok: true as const,
      value: { queries: [{ text: 'faith' }] },
    })),
    verses: jest.fn(async () => ({
      ok: true as const,
      value: { verses: [{ id: 'JHN.3.16' }], didYouMean: [] },
    })),
    topics: jest.fn(async () => ({
      ok: true as const,
      value: { topics: [], didYouMean: [], totalSize: 0 },
    })),
    ...overrides,
  }
}

const fetchBibleContent: FetchBibleContent = async () => ({
  status: 200,
  body: '{"content":"For God so loved the world","reference":"John 3:16"}',
  contentType: 'application/json',
})

function wrapperFor(stub: UseSearchResult, locale = 'en') {
  return youVersionProviderWrapper('light', locale, { useSearch: () => stub })
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

describe('BibleReaderSearchSheet', () => {
  beforeEach(() => {
    setImpl('NativeSheet', ({ children, isOpen, headerTitle, onClose }) =>
      isOpen ? (
        <View testID="search-sheet">
          {headerTitle !== undefined && <Text>{headerTitle}</Text>}
          {children}
          <Pressable testID="sheet-close" onPress={onClose}>
            <Text>Close</Text>
          </Pressable>
        </View>
      ) : null,
    )
    return resetSearchHistoryStore()
  })

  afterEach(() => {
    resetImpls()
  })

  it('puts the field and Cancel in the header and asks trending in the version language', async () => {
    const stub = searchStub()
    const onClose = jest.fn()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={onClose}
        versionId={111}
        languageTag="es"
        theme="light"
        fetchBibleContent={fetchBibleContent}
        onSelectReference={() => {}}
      />,
      { wrapper: wrapperFor(stub, 'en') },
    )
    await flush()

    expect(stub.trendingQueries).toHaveBeenCalledWith({ languageRanges: ['es'] })
    expect(screen.getByTestId('bible-reader-search-field')).toBeTruthy()
    expect(screen.getByTestId('bible-reader-search-cancel')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
    expect(screen.queryByText('OK')).toBeNull()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-cancel'))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('focuses the search field when the sheet opens and blurs it when the sheet closes', async () => {
    const focus = jest.spyOn(TextInput.prototype, 'focus')
    const blur = jest.spyOn(TextInput.prototype, 'blur')
    // Production NativeSheet keeps children mounted while closed. The suite
    // mock unmounts them, which clears the field ref before blur can run.
    setImpl('NativeSheet', ({ children, headerTitle, onClose }) => (
      <View testID="search-sheet">
        {headerTitle !== undefined && <Text>{headerTitle}</Text>}
        {children}
        <Pressable testID="sheet-close" onPress={onClose}>
          <Text>Close</Text>
        </Pressable>
      </View>
    ))
    const stub = searchStub()
    const props = {
      onClose: () => {},
      versionId: 111,
      languageTag: 'en',
      theme: 'light' as const,
      fetchBibleContent,
      onSelectReference: () => {},
    }
    try {
      const { rerender } = render(<BibleReaderSearchSheet isOpen={false} {...props} />, {
        wrapper: wrapperFor(stub),
      })
      await flush()
      focus.mockClear()
      blur.mockClear()

      rerender(<BibleReaderSearchSheet isOpen {...props} />)
      await flush()

      expect(focus.mock.instances[0].props.testID).toBe('bible-reader-search-field')
      focus.mockClear()
      blur.mockClear()

      rerender(<BibleReaderSearchSheet isOpen={false} {...props} />)
      await flush()

      expect(blur.mock.instances[0].props.testID).toBe('bible-reader-search-field')
    } finally {
      focus.mockRestore()
      blur.mockRestore()
    }
  })

  it('shows Trending Searches while trending is still loading and omits Recents when empty', async () => {
    const pending = deferred<SearchApiResult<YouVersionSearchQueries>>()
    const stub = searchStub({
      trendingQueries: jest.fn(async () => pending.promise),
    })
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={() => {}}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={fetchBibleContent}
        onSelectReference={() => {}}
      />,
      { wrapper: wrapperFor(stub) },
    )

    expect(screen.getByText('Trending Searches')).toBeTruthy()
    expect(screen.getByTestId('bible-reader-search-loading')).toBeTruthy()
    expect(screen.queryByText('Recent Searches')).toBeNull()
    expect(screen.queryByText('faith')).toBeNull()

    await act(async () => {
      pending.resolve({ ok: true, value: { queries: [{ text: 'faith' }] } })
    })
    await flush()

    expect(screen.getByText('faith')).toBeTruthy()
    expect(screen.queryByTestId('bible-reader-search-loading')).toBeNull()
    expect(screen.queryByText('Recent Searches')).toBeNull()
  })

  it('labels Clear search distinctly from Cancel', async () => {
    const stub = searchStub()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={() => {}}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={fetchBibleContent}
        onSelectReference={() => {}}
      />,
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('bible-reader-search-field'), 'love')
    })

    expect(screen.getByLabelText('Clear search')).toBeTruthy()
    expect(screen.getByText('Cancel')).toBeTruthy()
  })

  it('falls back to * when the version language is missing', async () => {
    const stub = searchStub()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={() => {}}
        versionId={111}
        theme="light"
        fetchBibleContent={fetchBibleContent}
        onSelectReference={() => {}}
      />,
      { wrapper: wrapperFor(stub, 'fr') },
    )
    await flush()

    expect(stub.trendingQueries).toHaveBeenCalledWith({ languageRanges: ['*'] })
  })

  it('loads trending when it opens and submits a suggestion tap', async () => {
    const stub = searchStub()
    const onSelectReference = jest.fn()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={() => {}}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={fetchBibleContent}
        onSelectReference={onSelectReference}
      />,
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    expect(stub.trendingQueries).toHaveBeenCalled()
    expect(screen.getByText('faith')).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-suggestion-faith'))
    })
    await flush()

    expect(stub.verses).toHaveBeenCalledWith({
      query: 'faith',
      bibleId: 111,
      userIntent: 'unknown',
    })
  })

  it('shows at most three trending queries and three recents on the empty sheet', async () => {
    const stub = searchStub({
      trendingQueries: jest.fn(async () => ({
        ok: true as const,
        value: {
          queries: [
            { text: 'alpha' },
            { text: 'beta' },
            { text: 'gamma' },
            { text: 'delta' },
          ],
        },
      })),
    })
    const { record } = useSearchHistoryStore.getState()
    for (const text of ['four', 'three', 'two', 'one']) {
      const branded = nonBlankQuery(text)
      if (branded === null) {
        throw new Error(`test fixture query is blank: ${text}`)
      }
      record(branded)
    }

    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={() => {}}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={fetchBibleContent}
        onSelectReference={() => {}}
      />,
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    expect(screen.getByText('alpha')).toBeTruthy()
    expect(screen.getByText('beta')).toBeTruthy()
    expect(screen.getByText('gamma')).toBeTruthy()
    expect(screen.queryByText('delta')).toBeNull()
    expect(screen.getByText('one')).toBeTruthy()
    expect(screen.getByText('two')).toBeTruthy()
    expect(screen.getByText('three')).toBeTruthy()
    expect(screen.queryByText('four')).toBeNull()
  })

  it('shows Recents after a submit and a return to idle', async () => {
    const stub = searchStub()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={() => {}}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={fetchBibleContent}
        onSelectReference={() => {}}
      />,
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-suggestion-faith'))
    })
    await flush()

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('bible-reader-search-field'), '')
    })
    await flush()

    expect(screen.getByText('Recent Searches')).toBeTruthy()
    expect(screen.getAllByText('faith').length).toBeGreaterThan(0)
  })

  it('keeps a full-sheet spinner up until the passage title exists', async () => {
    const passage = deferred<{ status: number; body: string; contentType: string | null }>()
    const stub = searchStub()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={() => {}}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={async () => passage.promise}
        onSelectReference={() => {}}
      />,
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-suggestion-faith'))
    })
    await flush()

    expect(screen.getByTestId('bible-reader-search-loading')).toBeTruthy()
    expect(screen.queryByText('JHN 3:16')).toBeNull()
    expect(screen.queryByText('JHN.3.16')).toBeNull()
    expect(screen.queryByText('John 3:16')).toBeNull()

    await act(async () => {
      passage.resolve({
        status: 200,
        body: '{"content":"For God so loved the world","reference":"John 3:16"}',
        contentType: 'application/json',
      })
    })
    await flush()

    expect(screen.getByText('For God so loved the world')).toBeTruthy()
    expect(screen.getByText('John 3:16')).toBeTruthy()
    expect(screen.queryByText('JHN.3.16')).toBeNull()
    expect(screen.queryByText('JHN 3:16')).toBeNull()
  })

  it('shows the snippet above the title and omits a raw USFM line', async () => {
    const stub = searchStub()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={() => {}}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={fetchBibleContent}
        onSelectReference={() => {}}
      />,
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-suggestion-faith'))
    })
    await flush()

    expect(screen.getByTestId('bible-reader-search-result-JHN.3.16')).toBeTruthy()
    expect(screen.getByText('For God so loved the world')).toBeTruthy()
    expect(screen.getByText('John 3:16')).toBeTruthy()
    expect(screen.queryByText('JHN.3.16')).toBeNull()
    expect(screen.queryByText('JHN 3:16')).toBeNull()
  })

  it('centers a completed empty search', async () => {
    const stub = searchStub({
      verses: jest.fn(async () => ({
        ok: true as const,
        value: { verses: [], didYouMean: [] },
      })),
    })
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={() => {}}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={fetchBibleContent}
        onSelectReference={() => {}}
      />,
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-suggestion-faith'))
    })
    await flush()

    expect(screen.getByTestId('bible-reader-search-empty')).toBeTruthy()
    expect(
      screen.getByText("We're sorry, there are no Bible results for this search."),
    ).toBeTruthy()
    expect(screen.queryByTestId('bible-reader-search-result-JHN.3.16')).toBeNull()
  })

  it('centers a failed search and retries from that state', async () => {
    const verses = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        error: { kind: 'transient' as const, message: 'offline' },
      })
      .mockResolvedValueOnce({
        ok: true as const,
        value: { verses: [{ id: 'JHN.3.16' }], didYouMean: [] },
      })
    const stub = searchStub({ verses })
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={() => {}}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={fetchBibleContent}
        onSelectReference={() => {}}
      />,
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-suggestion-faith'))
    })
    await flush()

    expect(screen.getByTestId('bible-reader-search-error')).toBeTruthy()
    expect(screen.queryByTestId('bible-reader-search-result-JHN.3.16')).toBeNull()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-error'))
    })
    await flush()

    expect(screen.getByTestId('bible-reader-search-result-JHN.3.16')).toBeTruthy()
  })

  it('selects a verse, dismisses, and hands the parsed reference up', async () => {
    const stub = searchStub()
    const onClose = jest.fn()
    const onSelectReference = jest.fn()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={onClose}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={fetchBibleContent}
        onSelectReference={onSelectReference}
      />,
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-suggestion-faith'))
    })
    await flush()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-result-JHN.3.16'))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSelectReference).toHaveBeenCalledWith({
      versionId: 111,
      bookId: 'JHN',
      chapter: 3,
      verse: 16,
    } satisfies BibleReference)
  })

  it('selects a chapter-only hit and hands book plus chapter up', async () => {
    const stub = searchStub({
      verses: jest.fn(async () => ({
        ok: true as const,
        value: { verses: [{ id: 'PSA.23' }], didYouMean: [] },
      })),
    })
    const fetchChapter: FetchBibleContent = async () => ({
      status: 200,
      body: '{"content":"The Lord is my shepherd","reference":"Psalm 23"}',
      contentType: 'application/json',
    })
    const onClose = jest.fn()
    const onSelectReference = jest.fn()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={onClose}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={fetchChapter}
        onSelectReference={onSelectReference}
      />,
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-suggestion-faith'))
    })
    await flush()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-result-PSA.23'))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSelectReference).toHaveBeenCalledWith({
      versionId: 111,
      bookId: 'PSA',
      chapter: 23,
    } satisfies BibleReference)
  })

  it('selects a verse-range hit using the start verse as the anchor', async () => {
    const stub = searchStub({
      verses: jest.fn(async () => ({
        ok: true as const,
        value: { verses: [{ id: 'JHN.3.16-17' }], didYouMean: [] },
      })),
    })
    const fetchRange: FetchBibleContent = async () => ({
      status: 200,
      body: '{"content":"For God so loved the world","reference":"John 3:16-17"}',
      contentType: 'application/json',
    })
    const onClose = jest.fn()
    const onSelectReference = jest.fn()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={onClose}
        versionId={111}
        languageTag="en"
        theme="light"
        fetchBibleContent={fetchRange}
        onSelectReference={onSelectReference}
      />,
      { wrapper: wrapperFor(stub) },
    )
    await flush()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-suggestion-faith'))
    })
    await flush()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-result-JHN.3.16-17'))
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSelectReference).toHaveBeenCalledWith({
      versionId: 111,
      bookId: 'JHN',
      chapter: 3,
      verse: 16,
    } satisfies BibleReference)
  })
})
