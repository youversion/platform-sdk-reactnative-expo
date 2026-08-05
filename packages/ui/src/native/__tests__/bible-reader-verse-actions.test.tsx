/**
 * Layer 3 — the native verse action sheet, from a verse tap to Copy and Share.
 *
 * The reader mirrors the Web SDK's committed selection into native state so it
 * can raise a bottom sheet over the passage. Nothing about that sheet lives in
 * the WebView, so every assertion here is on the native side of the bridge plus
 * the one value travelling back: the clear signal.
 */
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import type { Highlight } from '@youversion/platform-react-native-expo-core'
import * as core from '@youversion/platform-react-native-expo-core'
import type { BibleReaderShareData, BibleReaderVerseSelection } from '@youversion/platform-react-ui'
import * as Clipboard from 'expo-clipboard'
import type { ReactNode } from 'react'
import { Platform, Share } from 'react-native'

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

const YELLOW = 'fffe00'
const GREEN = '5dff79'
const BLUE = '00d6ff'
const PINK = 'ff95ef'

function highlight(verse: number, color: string): Highlight {
  return { version_id: VERSION_ID, passage_id: `JHN.1.${verse}`, color }
}

/**
 * The two writes a swatch press can reach. `highlightPermissionFlowApply` is the guarded one — the
 * Permission Flow's wrapper, which may run sign-in or consent first — and
 * `rawRemove` is `useHighlights.remove`, deliberately ungated (ADR 0016).
 * Keeping them as separate stable mocks is what lets each test say which path a
 * press took.
 */
const highlightPermissionFlowApply = jest.fn(async () => ({ status: 'noop' }) as const)
const rawApply = jest.fn(async () => ({ status: 'noop' }) as const)
const rawRemove = jest.fn(async () => ({ status: 'noop' }) as const)

/**
 * `jest.setup.js` already stubs this hook globally (the real one needs core's own
 * provider, which UI tests replace). Steer it per test rather than re-mocking the
 * whole package and losing that passthrough provider.
 */
function stubHighlightPermissionFlow(highlights: Highlight[] = []) {
  jest
    .spyOn(core, 'useHighlightPermissionFlow')
    .mockImplementation(({ versionId, book, chapter }) => ({
      highlights: {
        highlights,
        scope: { versionId, book, chapter },
        isRefreshing: false,
        error: null,
        refresh: jest.fn(async () => undefined),
        apply: rawApply,
        remove: rawRemove,
      },
      isConfirming: false,
      apply: highlightPermissionFlowApply,
      confirm: jest.fn(),
      decline: jest.fn(),
      flowError: null,
    }))
}

/** Which verse-selection payload the mocked DOM component emits on the next press. */
let mockNextVerseSelection: BibleReaderVerseSelection = SELECTION

let latestDomProps: {
  clearSelectionSignal?: number
  onCopy?: unknown
  onShare?: unknown
  onVerseSelect?: (verseSelection: BibleReaderVerseSelection) => Promise<void>
} = {}

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
      onVerseSelect?: (verseSelection: BibleReaderVerseSelection) => Promise<void>
    }) {
      latestDomProps = props
      return (
        <View testID="mock-dom">
          <Pressable
            testID="trigger-verse-select"
            onPress={() => void props.onVerseSelect?.(mockNextVerseSelection)}
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

/** Emit a verse selection from the WebView, the way a verse tap would. */
async function selectVerses(verseSelection: BibleReaderVerseSelection = SELECTION) {
  mockNextVerseSelection = verseSelection
  await act(async () => {
    fireEvent.press(screen.getByTestId('trigger-verse-select'))
  })
}

beforeEach(() => {
  latestDomProps = {}
  mockNextVerseSelection = SELECTION
  highlightPermissionFlowApply.mockClear()
  rawApply.mockClear()
  rawRemove.mockClear()
  stubHighlightPermissionFlow()
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

describe('BibleReader verse action sheet — swatches', () => {
  it('projects the swatch tray from the painted highlights', async () => {
    stubHighlightPermissionFlow([highlight(1, YELLOW)])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()

    // Verse 1 is yellow, verse 2 is bare — so yellow gets a remove circle and
    // stays in the apply row (it can still extend over verse 2).
    expect(screen.getByTestId(`bible-verse-action-swatch-remove-${YELLOW}`)).toBeTruthy()
    expect(screen.getByTestId(`bible-verse-action-swatch-apply-${YELLOW}`)).toBeTruthy()
  })

  it('routes an apply swatch through the Permission Flow, never the raw write', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await act(async () => {
      fireEvent.press(screen.getByTestId(`bible-verse-action-swatch-apply-${GREEN}`))
    })

    // The flow's `apply`, not `useHighlights.apply`: a signed-out or
    // unpermitted user must get the sign-in / consent step, not a failed write.
    expect(highlightPermissionFlowApply).toHaveBeenCalledWith(GREEN, [1, 2])
    expect(rawApply).not.toHaveBeenCalled()
    expect(rawRemove).not.toHaveBeenCalled()
  })

  it('routes a remove swatch straight to the ungated write', async () => {
    stubHighlightPermissionFlow([highlight(1, BLUE), highlight(2, BLUE)])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await act(async () => {
      fireEvent.press(screen.getByTestId(`bible-verse-action-swatch-remove-${BLUE}`))
    })

    // ADR 0016: a user looking at their own highlight already has whatever the
    // write needs, so removal never runs the flow.
    expect(rawRemove).toHaveBeenCalledWith(BLUE, [1, 2])
    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
  })

  it('closes the sheet and clears the selection after a write', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    const before = latestDomProps.clearSelectionSignal
    await act(async () => {
      fireEvent.press(screen.getByTestId(`bible-verse-action-swatch-apply-${YELLOW}`))
    })

    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(latestDomProps.clearSelectionSignal).toBe((before ?? 0) + 1)
  })

  it('closes the sheet and clears the selection after a remove too', async () => {
    stubHighlightPermissionFlow([highlight(1, BLUE), highlight(2, BLUE)])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    const before = latestDomProps.clearSelectionSignal
    await act(async () => {
      fireEvent.press(screen.getByTestId(`bible-verse-action-swatch-remove-${BLUE}`))
    })

    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(latestDomProps.clearSelectionSignal).toBe((before ?? 0) + 1)
  })

  it('writes nothing when the sheet is dismissed', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await act(async () => {
      fireEvent.press(screen.getByTestId('sheet-dismiss'))
    })

    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
    expect(rawRemove).not.toHaveBeenCalled()
  })
})

/**
 * The tray is a fixed-width window over a horizontally scrolling strip: two
 * verses of different colors already produce seven circles (2 remove + 5
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
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 200)

    expect(screen.queryByTestId('bible-verse-action-swatch-fade-trailing')).toBeNull()
    expect(screen.queryByTestId('bible-verse-action-swatch-fade-leading')).toBeNull()
  })

  it('fades the trailing edge once the swatches overflow, without swallowing their taps', async () => {
    stubHighlightPermissionFlow([highlight(1, YELLOW), highlight(2, BLUE)])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 320)

    expect(screen.getByTestId('bible-verse-action-swatch-fade-trailing')).toBeTruthy()

    // The fade is `pointerEvents="none"`: a swatch beneath it is still live.
    await act(async () => {
      fireEvent.press(screen.getByTestId(`bible-verse-action-swatch-apply-${PINK}`))
    })
    expect(highlightPermissionFlowApply).toHaveBeenCalledWith(PINK, [1, 2])
  })

  /**
   * Each fade tracks what is left to scroll *toward its own edge*, not raw
   * overflow. Gating on overflow alone left the outermost swatch permanently
   * dimmed once the user had scrolled to it, which reads as disabled.
   */
  it('retires the trailing fade once the strip is scrolled to its end', async () => {
    stubHighlightPermissionFlow([highlight(1, YELLOW), highlight(2, BLUE)])
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
    stubHighlightPermissionFlow([highlight(1, YELLOW), highlight(2, BLUE)])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 320)

    expect(screen.queryByTestId('bible-verse-action-swatch-fade-leading')).toBeNull()

    scrollTray(60)

    expect(screen.getByTestId('bible-verse-action-swatch-fade-leading')).toBeTruthy()
  })

  it('draws both fades mid-strip, and neither swallows a swatch tap', async () => {
    stubHighlightPermissionFlow([highlight(1, YELLOW), highlight(2, BLUE)])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 320)
    scrollTray(60)

    expect(screen.getByTestId('bible-verse-action-swatch-fade-leading')).toBeTruthy()
    expect(screen.getByTestId('bible-verse-action-swatch-fade-trailing')).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByTestId(`bible-verse-action-swatch-apply-${PINK}`))
    })
    expect(highlightPermissionFlowApply).toHaveBeenCalledWith(PINK, [1, 2])
  })
})

/**
 * Web keeps the in-WebView popover, so the native sheet must stay out of its
 * way. `NativeSheet` already returns `null` there, but the reader also declines
 * to mount the sheet at all — the two have to agree, or a future `NativeSheet`
 * that renders something on web would put two verse-action UIs on screen.
 *
 * The other half of this fork, `verseActions="popover"` reaching the WebView, is
 * pinned at layer 1 in `lib/__tests__/resolve-verse-actions.test.ts`. It is read
 * once at module load, so flipping `Platform.OS` inside a test cannot move it.
 */
describe('BibleReader verse action sheet — web', () => {
  const originalOs = Platform.OS

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: originalOs,
    })
  })

  it('renders no verse action sheet on web, even with a live selection', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, enumerable: true, value: 'web' })

    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()

    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
  })

  it('still forwards the selection to the consumer on web', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, enumerable: true, value: 'web' })
    const onVerseSelect = jest.fn()

    render(
      <BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onVerseSelect={onVerseSelect} />,
      { wrapper },
    )

    await selectVerses()

    // The sheet is the only thing web gives up. `onVerseSelect` is a public prop
    // on every platform, and the popover fires it exactly as the sheet path does.
    expect(onVerseSelect).toHaveBeenCalledWith(SELECTION)
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
