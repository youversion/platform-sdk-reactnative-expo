import { act, fireEvent, render } from '@testing-library/react-native'
import type { Highlight, HighlightScope } from '@youversion/platform-react-native-expo-core'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type { ReactNode } from 'react'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { resetHighlightsMock, setMockHighlights } from '../../test-utils/highlights-mock'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

/**
 * Every `highlights` value the DOM component has ever been handed. The Web SDK
 * latches controlled mode on the prop's presence at first mount, so a single
 * `undefined` frame — mid-chapter-change, mid-sign-in — would silently drop the
 * reader into self-contained mode. Asserting the latest value is not enough;
 * the whole history has to be arrays.
 */
const mockHighlightsHistory: (Highlight[] | undefined)[] = []

let latestDomProps: {
  highlights?: Highlight[]
  book?: string
  chapter?: string
  versionId?: number
} = {}

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
      highlights?: Highlight[]
      book?: string
      chapter?: string
      versionId?: number
      onChapterChange?: (chapter: string) => Promise<void>
    }) {
      latestDomProps = props
      mockHighlightsHistory.push(props.highlights)
      return (
        <View testID="mock-dom">
          <Text testID="highlight-count">{String(props.highlights?.length ?? 'undefined')}</Text>
          <Text testID="chapter">{props.chapter ?? 'none'}</Text>
          <Pressable testID="trigger-chapter-change" onPress={() => props.onChapterChange?.('3')}>
            <Text>Chapter</Text>
          </Pressable>
        </View>
      )
    },
  }
})

jest.mock('../../dom/footnote-content', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: () => <View testID="mock-footnote" />,
  }
})

jest.mock('../bible-chapter-picker-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleChapterPickerSheet: () => <View testID="mock-chapter-picker-sheet" />,
  }
})

jest.mock('../bible-version-picker-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleVersionPickerSheet: () => <View testID="mock-version-picker-sheet" />,
  }
})

jest.mock('../native-sheet', () => {
  const actual = jest.requireActual('../native-sheet')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    ...actual,
    NativeSheet: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
      isOpen ? <View testID="sheet">{children}</View> : null,
  }
})

jest.mock('../bible-reader-settings-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleReaderSettingsSheet: () => <View testID="mock-settings-sheet" />,
  }
})

jest.mock('../../stores/reader-settings-store', () => ({
  useReaderSettingsStore: () => ({
    fontSize: 16,
    fontFamily: '"Inter", sans-serif',
    setFontSize: jest.fn(),
    setFontFamily: jest.fn(),
  }),
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

const VERSION_ID = 111

const JHN_1_HIGHLIGHTS: Highlight[] = [
  { version_id: VERSION_ID, passage_id: 'JHN.1.1', color: 'fffe00' },
  { version_id: VERSION_ID, passage_id: 'JHN.1.2', color: 'fffe00' },
]

const JHN_3_HIGHLIGHTS: Highlight[] = [
  { version_id: VERSION_ID, passage_id: 'JHN.3.16', color: '00d6ff' },
]

function highlightsForScope(scope: HighlightScope): Highlight[] {
  if (scope.book !== 'JHN' || scope.versionId !== VERSION_ID) return []
  if (scope.chapter === '1') return JHN_1_HIGHLIGHTS
  if (scope.chapter === '3') return JHN_3_HIGHLIGHTS
  return []
}

describe('BibleReader highlights read path', () => {
  beforeEach(async () => {
    latestDomProps = {}
    mockHighlightsHistory.length = 0
    resetHighlightsMock()
    mmkvStorage.clearAll()
    useReaderLocationStore.setState(readerLocationStoreInitialState)
    await useReaderLocationStore.persist.rehydrate()
  })

  it('passes the hook’s highlights straight through to the DOM component', () => {
    setMockHighlights(JHN_1_HIGHLIGHTS)

    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.highlights).toBe(JHN_1_HIGHLIGHTS)
  })

  it('passes an empty array — never undefined — when signed out', () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.highlights).toEqual([])
    expect(mockHighlightsHistory.every(Array.isArray)).toBe(true)
  })

  it('never hands the DOM component undefined across re-render, chapter change, or auth change', async () => {
    setMockHighlights(highlightsForScope)

    const { rerender, getByTestId } = render(<BibleReader versionId={VERSION_ID} />, { wrapper })

    // Plain re-render.
    rerender(<BibleReader versionId={VERSION_ID} />)

    // Chapter change driven from inside the WebView, as the reader does.
    await act(async () => {
      fireEvent.press(getByTestId('trigger-chapter-change'))
    })

    // Sign-out: the hook starts reporting nothing for every scope.
    setMockHighlights([])
    rerender(<BibleReader versionId={VERSION_ID} />)

    // Sign-in: data comes back.
    setMockHighlights(highlightsForScope)
    rerender(<BibleReader versionId={VERSION_ID} />)

    expect(mockHighlightsHistory.length).toBeGreaterThan(4)
    expect(mockHighlightsHistory.every(Array.isArray)).toBe(true)
  })

  it('re-scopes to the new chapter’s highlights when the chapter changes', async () => {
    setMockHighlights(highlightsForScope)

    // Uncontrolled: the reader owns the chapter, so the DOM-driven change lands.
    const { getByTestId } = render(<BibleReader versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.chapter).toBe('1')
    expect(latestDomProps.highlights).toBe(JHN_1_HIGHLIGHTS)

    await act(async () => {
      fireEvent.press(getByTestId('trigger-chapter-change'))
    })

    expect(latestDomProps.chapter).toBe('3')
    expect(latestDomProps.highlights).toBe(JHN_3_HIGHLIGHTS)
  })
})
