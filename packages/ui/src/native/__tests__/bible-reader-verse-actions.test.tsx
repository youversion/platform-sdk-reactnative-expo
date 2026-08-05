/**
 * Layer 3 — the native verse action sheet, from a verse tap to Copy and Share.
 *
 * The reader mirrors the Web SDK's committed selection into native state so it
 * can raise a bottom sheet over the passage. Nothing about that sheet lives in
 * the WebView, so every assertion here is on the native side of the bridge plus
 * the one value travelling back: the clear signal.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { BibleReaderShareData, BibleReaderVerseSelection } from '@youversion/platform-react-ui'
import * as Clipboard from 'expo-clipboard'
import type { ReactNode } from 'react'
import { Share } from 'react-native'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}))

const VERSION_ID = 111

const SHARE_DATA: BibleReaderShareData = {
  text: '“In the beginning was the Word...”\n\nJohn 1:1-2 BSB',
  reference: 'John 1:1-2 BSB',
  verseText: '“In the beginning was the Word...”',
  verses: [1, 2],
  book: 'JHN',
  chapter: '1',
  versionId: VERSION_ID,
}

const SELECTION: BibleReaderVerseSelection = {
  versionId: VERSION_ID,
  book: 'JHN',
  chapter: '1',
  verses: [1, 2],
  passageIds: ['JHN.1.1', 'JHN.1.2'],
  reference: 'John 1:1-2',
  shareData: SHARE_DATA,
}

const CLEARED_SELECTION: BibleReaderVerseSelection = {
  ...SELECTION,
  verses: [],
  passageIds: [],
  reference: '',
  shareData: null,
}

/** Which selection payload the mocked DOM component emits on the next press. */
let mockNextSelection: BibleReaderVerseSelection = SELECTION

let latestDomProps: {
  clearSelectionSignal?: number
  onCopy?: unknown
  onShare?: unknown
  onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
} = {}

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
      onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
    }) {
      latestDomProps = props
      return (
        <View testID="mock-dom">
          <Pressable
            testID="trigger-verse-select"
            onPress={() => void props.onVerseSelect?.(mockNextSelection)}
          >
            <Text>Select</Text>
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

jest.mock('../bible-reader-settings-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleReaderSettingsSheet: () => <View testID="mock-settings-sheet" />,
  }
})

/**
 * Real `NativeSheet` drives a Gorhom bottom sheet through a portal host; the
 * only thing these tests need from it is "renders its children while open, and
 * calls `onClose` when dismissed". `sheet-dismiss` stands in for the swipe-down
 * and displacement paths, both of which reach the same handler.
 *
 * `sheet-modal-<bool>` surfaces the `modal` prop so the verse action sheet's
 * non-modal contract is pinned. That is not cosmetic: a modal sheet renders a
 * backdrop that swallows taps on the passage, which makes it impossible to add a
 * second verse to the selection.
 */
jest.mock('../native-sheet', () => {
  const actual = jest.requireActual('../native-sheet')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    ...actual,
    NativeSheet: ({
      isOpen,
      onClose,
      modal,
      children,
    }: {
      isOpen: boolean
      onClose: () => void
      modal?: boolean
      children: ReactNode
    }) =>
      isOpen ? (
        <View testID="sheet">
          <View testID={`sheet-modal-${modal !== false}`} />
          <Pressable testID="sheet-dismiss" onPress={onClose}>
            <Text>Dismiss</Text>
          </Pressable>
          {children}
        </View>
      ) : null,
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

/** Emit a selection from the WebView, the way a verse tap would. */
async function selectVerses(selection: BibleReaderVerseSelection = SELECTION) {
  mockNextSelection = selection
  await act(async () => {
    fireEvent.press(screen.getByTestId('trigger-verse-select'))
  })
}

beforeEach(() => {
  latestDomProps = {}
  mockNextSelection = SELECTION
  useReaderLocationStore.setState(readerLocationStoreInitialState)
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
})

afterEach(() => {
  jest.restoreAllMocks()
  ;(Clipboard.setStringAsync as jest.Mock).mockClear()
})

describe('BibleReader verse action sheet — visibility', () => {
  it('stays closed until a selection arrives', () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
  })

  it('opens on a populated selection and labels itself with the localized reference', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()

    expect(screen.getByTestId('bible-verse-action-sheet')).toBeTruthy()
    // `John 1:1-2`, not `JHN 1:1-2` — the human-readable half of the 2.5.0 payload.
    expect(screen.getByTestId('bible-verse-action-reference').children).toContain('John 1:1-2')
  })

  /**
   * Regression guard. A modal sheet draws a backdrop over the passage that eats
   * the next tap and closes the sheet, so the user can never select a second
   * verse. The passage has to stay interactive while the selection is still
   * being built.
   */
  it('is non-modal, so the passage behind it stays tappable', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()

    expect(screen.getByTestId('sheet-modal-false')).toBeTruthy()
  })

  it('closes when the selection clears', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await selectVerses(CLEARED_SELECTION)

    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
  })

  it('still forwards every selection payload to the consumer, clear included', async () => {
    const onVerseSelect = jest.fn()
    render(
      <BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onVerseSelect={onVerseSelect} />,
      { wrapper },
    )

    await selectVerses()
    await selectVerses(CLEARED_SELECTION)

    expect(onVerseSelect).toHaveBeenNthCalledWith(1, SELECTION)
    expect(onVerseSelect).toHaveBeenNthCalledWith(2, CLEARED_SELECTION)
  })
})

describe('BibleReader verse action sheet — the bridge', () => {
  it('always supplies its own onVerseSelect, even with no consumer handler', () => {
    // This used to be `undefined` when the consumer passed nothing. The sheet
    // cannot open without it, so the SDK now owns the handler.
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.onVerseSelect).toBeDefined()
  })

  it('sends no copy/share Native Actions', () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    // Dead Native Actions would cost a bridge round-trip per copy for nothing:
    // with no popover there is no in-WebView button left to fire them.
    expect(latestDomProps.onCopy).toBeUndefined()
    expect(latestDomProps.onShare).toBeUndefined()
  })

  it('does not clear the selection at mount', () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.clearSelectionSignal).toBe(0)
  })

  it('adds its own clears to the consumer’s signal rather than replacing it', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} clearSelectionSignal={7} />, {
      wrapper,
    })
    expect(latestDomProps.clearSelectionSignal).toBe(7)

    await selectVerses()
    await act(async () => {
      fireEvent.press(screen.getByTestId('sheet-dismiss'))
    })

    expect(latestDomProps.clearSelectionSignal).toBe(8)
  })

  it('bumps clearSelectionSignal on a sheet dismiss', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    const before = latestDomProps.clearSelectionSignal
    await act(async () => {
      fireEvent.press(screen.getByTestId('sheet-dismiss'))
    })

    expect(latestDomProps.clearSelectionSignal).toBe((before ?? 0) + 1)
    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
  })
})

describe('BibleReader verse action sheet — copy and share', () => {
  it('runs copy and share off the selection payload, then clears the selection', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    const before = latestDomProps.clearSelectionSignal
    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-verse-action-copy'))
    })
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(SHARE_DATA.text)
    expect(latestDomProps.clearSelectionSignal).toBe((before ?? 0) + 1)
    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()

    await selectVerses()
    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-verse-action-share'))
    })
    expect(Share.share).toHaveBeenCalledWith({ message: SHARE_DATA.text })
    expect(latestDomProps.clearSelectionSignal).toBe((before ?? 0) + 2)
  })

  it('lets a consumer override replace the SDK fallback', async () => {
    const onCopy = jest.fn()
    const onShare = jest.fn()
    render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={VERSION_ID}
        onCopy={onCopy}
        onShare={onShare}
      />,
      { wrapper },
    )

    await selectVerses()
    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-verse-action-copy'))
    })

    await selectVerses()
    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-verse-action-share'))
    })

    expect(onCopy).toHaveBeenCalledWith(SHARE_DATA)
    expect(onShare).toHaveBeenCalledWith(SHARE_DATA)
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
    expect(Share.share).not.toHaveBeenCalled()
  })
})
