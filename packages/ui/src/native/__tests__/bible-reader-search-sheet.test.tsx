import type {
  BibleReference,
  FetchBibleContent,
  UseSearchResult,
} from '@youversion/platform-react-native-expo-core'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable, Text, View } from 'react-native'

import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReaderSearchSheet } from '../bible-reader-search-sheet'

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
  })

  afterEach(() => {
    resetImpls()
  })

  it('puts the field and Done in the header and asks trending in the version language', async () => {
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
    expect(screen.getByTestId('bible-reader-search-done')).toBeTruthy()
    expect(screen.getByText('OK')).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-done'))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
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

