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
    suggestedQueries: jest.fn(async () => ({ ok: true as const, value: [] })),
    trendingQueries: jest.fn(async () => ({
      ok: true as const,
      value: [{ text: 'faith' }],
    })),
    verses: jest.fn(async () => ({
      ok: true as const,
      value: { verses: [{ reference: 'JHN.3.16' }], didYouMean: [] },
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

function wrapperFor(stub: UseSearchResult) {
  return youVersionProviderWrapper('light', 'en', { useSearch: () => stub })
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
          <Text>{headerTitle}</Text>
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

  it('loads trending when it opens and submits a suggestion tap', async () => {
    const stub = searchStub()
    const onSelectReference = jest.fn()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={() => {}}
        versionId={111}
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

  it('selects a verse, dismisses, and hands the parsed reference up', async () => {
    const stub = searchStub()
    const onClose = jest.fn()
    const onSelectReference = jest.fn()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={onClose}
        versionId={111}
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

  it('ignores a malformed USFM tap and stays in Search', async () => {
    const stub = searchStub({
      verses: jest.fn(async () => ({
        ok: true as const,
        value: { verses: [{ reference: 'not-a-usfm' }], didYouMean: [] },
      })),
    })
    const onClose = jest.fn()
    const onSelectReference = jest.fn()
    render(
      <BibleReaderSearchSheet
        isOpen
        onClose={onClose}
        versionId={111}
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
      fireEvent.press(screen.getByTestId('bible-reader-search-result-not-a-usfm'))
    })

    expect(onClose).not.toHaveBeenCalled()
    expect(onSelectReference).not.toHaveBeenCalled()
    expect(screen.getByTestId('search-sheet')).toBeTruthy()
  })
})
