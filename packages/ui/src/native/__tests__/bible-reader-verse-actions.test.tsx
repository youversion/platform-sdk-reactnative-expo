import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { Highlight } from '@youversion/platform-react-native-expo-core'
import type { BibleReaderShareData, BibleReaderVerseSelection } from '@youversion/platform-react-ui'
import * as Clipboard from 'expo-clipboard'
import type { ReactNode } from 'react'
import { Share } from 'react-native'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { resetAuthMock, setMockAuth, setMockSignedIn } from '../../test-utils/auth-mock'
import {
  highlightsMock,
  resetHighlightsMock,
  setMockHighlights,
} from '../../test-utils/highlights-mock'
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

function highlight(verse: number, color: string): Highlight {
  return { version_id: VERSION_ID, passage_id: `JHN.1.${verse}`, color }
}

/** Which selection payload the mocked DOM component emits on the next press. */
let mockNextSelection: BibleReaderVerseSelection = SELECTION

let latestDomProps: {
  verseActions?: 'popover' | 'none'
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

jest.mock('../bible-reader-settings-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleReaderSettingsSheet: () => <View testID="mock-settings-sheet" />,
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
  resetHighlightsMock()
  resetAuthMock()
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
   * verse — confirmed on device before this was fixed. The passage has to stay
   * interactive while the selection is still being built.
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
  it('suppresses the Web SDK popover and sends no copy/share Native Actions', () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.verseActions).toBe('none')
    // Dead Native Actions would cost a bridge round-trip per copy for nothing:
    // with no popover there is no in-WebView button left to fire them.
    expect(latestDomProps.onCopy).toBeUndefined()
    expect(latestDomProps.onShare).toBeUndefined()
  })

  it('always supplies its own onVerseSelect, even with no consumer handler', () => {
    // Pre-Phase-9 this was `undefined` when the consumer passed nothing. The
    // sheet cannot open without it, so the SDK now owns the handler.
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.onVerseSelect).toBeDefined()
  })

  it('does not clear the selection at mount', () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.clearSelectionSignal).toBe(0)
  })

  it('bumps clearSelectionSignal on a sheet dismiss, and writes nothing', async () => {
    setMockSignedIn()
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    const before = latestDomProps.clearSelectionSignal
    await act(async () => {
      fireEvent.press(screen.getByTestId('sheet-dismiss'))
    })

    expect(latestDomProps.clearSelectionSignal).toBe((before ?? 0) + 1)
    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(highlightsMock.apply).not.toHaveBeenCalled()
    expect(highlightsMock.remove).not.toHaveBeenCalled()
  })
})

describe('BibleReader verse action sheet — swatches', () => {
  it('projects the swatch tray from the painted highlights', async () => {
    setMockSignedIn()
    setMockHighlights([highlight(1, 'fffe00')])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()

    // Verse 1 is yellow, verse 2 is bare — so yellow gets a remove circle and
    // stays in the apply row (it can still extend over verse 2).
    expect(screen.getByTestId('bible-verse-action-swatch-remove-fffe00')).toBeTruthy()
    expect(screen.getByTestId('bible-verse-action-swatch-apply-fffe00')).toBeTruthy()
  })

  it('routes an apply swatch into the write path with the selection scope and colour', async () => {
    setMockSignedIn()
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-verse-action-swatch-apply-5dff79'))
    })

    expect(highlightsMock.apply).toHaveBeenCalledWith('5dff79', [1, 2])
    expect(highlightsMock.remove).not.toHaveBeenCalled()
  })

  it('routes a remove swatch into the remove path', async () => {
    setMockSignedIn()
    setMockHighlights([highlight(1, '00d6ff'), highlight(2, '00d6ff')])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-verse-action-swatch-remove-00d6ff'))
    })

    expect(highlightsMock.remove).toHaveBeenCalledWith('00d6ff', [1, 2])
    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })

  it('closes the sheet and clears the selection after a write', async () => {
    setMockSignedIn()
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    const before = latestDomProps.clearSelectionSignal
    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-verse-action-swatch-apply-fffe00'))
    })

    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(latestDomProps.clearSelectionSignal).toBe((before ?? 0) + 1)
  })

  it('closes the action sheet and opens the sign-in sheet when signed out', async () => {
    setMockAuth({ isAuthConfigured: true })
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-verse-action-swatch-apply-fffe00'))
    })

    // Never two sheets: the action sheet is gone before the prompt appears.
    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(screen.getByTestId('sign-in-with-youversion-sheet')).toBeTruthy()
    expect(highlightsMock.apply).not.toHaveBeenCalled()
  })
})

/**
 * The tray is a fixed-width window over a horizontally scrolling strip: two
 * verses of different colours already produce seven circles (2 remove + 5
 * apply), and the palette's worst case is ten. `measureTray` stands in for the
 * layout pass, which never runs under jest.
 */
describe('BibleReader verse action sheet — swatch tray overflow', () => {
  function measureTray(trayWidth: number, contentWidth: number) {
    const scroll = screen.getByTestId('bible-verse-action-swatch-scroll')
    fireEvent(scroll, 'layout', { nativeEvent: { layout: { width: trayWidth } } })
    fireEvent(scroll, 'contentSizeChange', contentWidth, 56)
  }

  function scrollTray(x: number) {
    fireEvent.scroll(screen.getByTestId('bible-verse-action-swatch-scroll'), {
      nativeEvent: { contentOffset: { x, y: 0 } },
    })
  }

  it('draws neither fade while every swatch fits the tray', async () => {
    setMockSignedIn()
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 200)

    expect(screen.queryByTestId('bible-verse-action-swatch-fade-trailing')).toBeNull()
    expect(screen.queryByTestId('bible-verse-action-swatch-fade-leading')).toBeNull()
  })

  it('fades the trailing edge once the swatches overflow, without swallowing their taps', async () => {
    setMockSignedIn()
    setMockHighlights([highlight(1, 'fffe00'), highlight(2, '00d6ff')])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 320)

    expect(screen.getByTestId('bible-verse-action-swatch-fade-trailing')).toBeTruthy()

    // The fade is `pointerEvents="none"`: a swatch beneath it is still live.
    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-verse-action-swatch-apply-ff95ef'))
    })
    expect(highlightsMock.apply).toHaveBeenCalledWith('ff95ef', [1, 2])
  })

  /**
   * Each fade tracks what is left to scroll *toward its own edge*, not raw
   * overflow. Gating on overflow alone left the outermost swatch permanently
   * dimmed once the user had scrolled to it, which reads as disabled.
   */
  it('retires the trailing fade once the strip is scrolled to its end', async () => {
    setMockSignedIn()
    setMockHighlights([highlight(1, 'fffe00'), highlight(2, '00d6ff')])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 320)
    scrollTray(120)

    expect(screen.queryByTestId('bible-verse-action-swatch-fade-trailing')).toBeNull()
  })

  /**
   * The leading fade is the mirror: it is the only cue that swatches exist back
   * the way you came, since the tray hard-cuts its left edge otherwise.
   */
  it('draws no leading fade at the head of the strip, and fades it in once scrolled', async () => {
    setMockSignedIn()
    setMockHighlights([highlight(1, 'fffe00'), highlight(2, '00d6ff')])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 320)

    expect(screen.queryByTestId('bible-verse-action-swatch-fade-leading')).toBeNull()

    scrollTray(60)

    expect(screen.getByTestId('bible-verse-action-swatch-fade-leading')).toBeTruthy()
  })

  it('draws both fades mid-strip, and neither swallows a swatch tap', async () => {
    setMockSignedIn()
    setMockHighlights([highlight(1, 'fffe00'), highlight(2, '00d6ff')])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 320)
    scrollTray(60)

    expect(screen.getByTestId('bible-verse-action-swatch-fade-leading')).toBeTruthy()
    expect(screen.getByTestId('bible-verse-action-swatch-fade-trailing')).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-verse-action-swatch-apply-ff95ef'))
    })
    expect(highlightsMock.apply).toHaveBeenCalledWith('ff95ef', [1, 2])
  })
})

describe('BibleReader verse action sheet — copy and share', () => {
  // The consumer-override-then-SDK-fallback contract itself is Phase 5's and
  // lives in `bible-reader-selection.test.tsx`, rewired to this call site. What
  // is new here is that both run off the selection's `shareData` and clear the
  // selection afterwards.
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
})
