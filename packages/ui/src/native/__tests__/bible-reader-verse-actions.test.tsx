/**
 * Layer 3 — the native verse action sheet, from a verse tap to Copy and Share.
 *
 * The reader mirrors the Web SDK's committed selection into native state so it
 * can raise a bottom sheet over the passage. Nothing about that sheet lives in
 * the WebView, so every assertion here is on the native side of the bridge plus
 * the one value travelling back: the clear signal.
 */
import type {
  Highlight,
  HookOverrides,
  UseHighlightsOptions,
} from '@youversion/platform-react-native-expo-core'
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native'
import type { BibleReaderShareData, BibleReaderVerseSelection } from '../../types/bible-ui-types'
import type {
  BibleReaderCustomVerseAction,
  VerseIndicatorStyleResolver,
  VerseIndicatorTarget,
} from '../../types/verse-hook-types'
import * as Clipboard from 'expo-clipboard'
import type { ReactNode } from 'react'
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { emptyHighlights, signedOutAuth } from '../../test-utils/default-hook-overrides'
import {
  installBibleReaderTestImpls,
  resetImpls,
  setImpl,
} from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'

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

const YELLOW = 'ffec5b'
const GREEN = 'b4ffc1'
const BLUE = 'bbf4ff'
const PINK = 'ffcff8'

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

let permissionHighlights: Highlight[] = []

function stubHighlightPermissionFlow(highlights: Highlight[] = []) {
  permissionHighlights = highlights
}

function useHighlightPermissionFlow({ versionId, book, chapter }: UseHighlightsOptions) {
  return {
    highlights: {
      ...emptyHighlights({ versionId, book, chapter }),
      highlights: permissionHighlights,
      apply: rawApply,
      remove: rawRemove,
    },
    isConfirming: false,
    apply: highlightPermissionFlowApply,
    confirm: jest.fn(),
    decline: jest.fn(),
    flowError: null,
  }
}

const signedInAuth = signedOutAuth({
  isAuthenticated: true,
  accessToken: 'test-token',
  getAccessToken: async () => ({ status: 'ok', token: 'test-token', userId: null }),
  requestedPermissions: ['highlights'],
  grantedPermissions: ['highlights'],
  hasPermission: () => true,
})

const testHookOverrides: HookOverrides = {
  useYVAuth: null,
  useHighlightPermissionFlow,
}

/**
 * A consumer *with* `auth` configured. The default in these tests is `null` —
 * no AuthProvider, the kids-app case: no sign-in, so no highlight swatches.
 */
function stubAuth() {
  testHookOverrides.useYVAuth = signedInAuth
}

/** Which verse-selection payload the mocked DOM component emits on the next press. */
let mockNextVerseSelection: BibleReaderVerseSelection = SELECTION

type LatestDomProps = {
  clearSelectionSignal?: number
  onCopy?: (data: BibleReaderShareData) => Promise<void>
  onShare?: (data: BibleReaderShareData) => Promise<void>
  onVerseSelect?: (verseSelection: BibleReaderVerseSelection) => Promise<void>
  verseIndicatorStyle?: VerseIndicatorStyleResolver
  onVerseIndicatorPress?: (target: VerseIndicatorTarget) => void
}

let latestDomProps: LatestDomProps = {}

function MockDOM(props: LatestDomProps) {
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
}

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
 *
 * `latestSheetProps` captures the gesture props for the same reason: the swatch
 * tray's horizontal scroll and the sheet's swipe-down both depend on how the
 * sheet's pan is configured, and only one configuration keeps both.
 */
type LatestSheetProps = {
  enableContentPanningGesture?: boolean
  panActiveOffsetY?: [number, number]
}

let latestSheetProps: LatestSheetProps = {}

type MockNativeSheetProps = {
  isOpen: boolean
  onClose: () => void
  modal?: boolean
  enableContentPanningGesture?: boolean
  panActiveOffsetY?: [number, number]
  children: ReactNode
}

function MockNativeSheet({
  isOpen,
  onClose,
  modal,
  enableContentPanningGesture,
  panActiveOffsetY,
  children,
}: MockNativeSheetProps) {
  if (isOpen) {
    latestSheetProps = { enableContentPanningGesture, panActiveOffsetY }
  }
  return isOpen ? (
    <View testID="sheet">
      <View testID={`sheet-modal-${modal !== false}`} />
      <Pressable testID="sheet-dismiss" onPress={onClose}>
        <Text>Dismiss</Text>
      </Pressable>
      {children}
    </View>
  ) : null
}

const wrapper = youVersionProviderWrapper('light', undefined, testHookOverrides)

const user = userEvent.setup()

/** Emit a verse selection from the WebView, the way a verse tap would. */
async function selectVerses(verseSelection: BibleReaderVerseSelection = SELECTION) {
  mockNextVerseSelection = verseSelection
  await user.press(screen.getByTestId('trigger-verse-select'))
}

beforeEach(() => {
  latestDomProps = {}
  latestSheetProps = {}
  mockNextVerseSelection = SELECTION
  highlightPermissionFlowApply.mockClear()
  rawApply.mockClear()
  rawRemove.mockClear()
  stubHighlightPermissionFlow()
  testHookOverrides.useYVAuth = null
  installBibleReaderTestImpls()
  setImpl('BibleReaderNative', MockDOM)
  setImpl('NativeSheet', MockNativeSheet)
  useReaderLocationStore.setState(readerLocationStoreInitialState)
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
  jest.spyOn(Clipboard, 'setStringAsync').mockResolvedValue(true)
})

afterEach(() => {
  resetImpls()
  jest.restoreAllMocks()
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
   * A consumer with no `auth` config (a kids app, no sign-in) still gets Copy
   * and Share. Highlight colors would tap into a write that can only fail, and
   * the sign-in prompt has nowhere to go, so the tray stays off. The buttons
   * grow to fill the row instead of sitting compact on one edge; auto basis keeps
   * a long custom label scrolling rather than squeezed.
   */
  it('omits highlight swatches when auth is unconfigured, and keeps Copy and Share', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()

    expect(screen.getByTestId('bible-verse-action-sheet')).toBeTruthy()
    expect(screen.queryByTestId('bible-verse-action-swatches')).toBeNull()
    expect(
      StyleSheet.flatten(screen.getByTestId('bible-verse-action-copy').props.style).flexGrow,
    ).toBe(1)
    expect(
      StyleSheet.flatten(screen.getByTestId('bible-verse-action-share').props.style).flexGrow,
    ).toBe(1)
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

  /**
   * Regression guard, from a Pixel 6 Pro pass where the swatch tray would not
   * scroll at all. Gorhom's pan has no activation criteria by default, so RNGH
   * falls back to a direction-agnostic touch slop, the sheet claims the sideways
   * drag, and the tray's ScrollView has its touches cancelled. Every swatch past
   * the sixth was unreachable — routine, since a selection spanning two colors
   * already produces seven.
   *
   * Both halves of this assertion matter. Constraining the pan to vertical
   * intent is the fix; disabling content panning cures the same symptom but
   * removes swipe-down, and this backdrop-less sheet has no tap-outside exit to
   * fall back on.
   */
  it('constrains the sheet pan to vertical intent so the swatch tray can scroll', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()

    expect(latestSheetProps.panActiveOffsetY).toEqual([-10, 10])
    expect(latestSheetProps.enableContentPanningGesture).toBeUndefined()
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
    await user.press(screen.getByTestId('sheet-dismiss'))

    expect(latestDomProps.clearSelectionSignal).toBe(8)
  })

  it('bumps clearSelectionSignal on a sheet dismiss', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    const before = latestDomProps.clearSelectionSignal
    await user.press(screen.getByTestId('sheet-dismiss'))

    expect(latestDomProps.clearSelectionSignal).toBe((before ?? 0) + 1)
    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
  })
})

describe('BibleReader verse action sheet — swatches', () => {
  beforeEach(() => {
    stubAuth()
  })

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
    await user.press(screen.getByTestId(`bible-verse-action-swatch-apply-${GREEN}`))

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
    await user.press(screen.getByTestId(`bible-verse-action-swatch-remove-${BLUE}`))

    // ADR 0016: a user looking at their own highlight already has whatever the
    // write needs, so removal never runs the flow.
    expect(rawRemove).toHaveBeenCalledWith(BLUE, [1, 2])
    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
  })

  it('closes the sheet and clears the selection after a write', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    const before = latestDomProps.clearSelectionSignal
    await user.press(screen.getByTestId(`bible-verse-action-swatch-apply-${YELLOW}`))

    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(latestDomProps.clearSelectionSignal).toBe((before ?? 0) + 1)
  })

  it('closes the sheet and clears the selection after a remove too', async () => {
    stubHighlightPermissionFlow([highlight(1, BLUE), highlight(2, BLUE)])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    const before = latestDomProps.clearSelectionSignal
    await user.press(screen.getByTestId(`bible-verse-action-swatch-remove-${BLUE}`))

    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(latestDomProps.clearSelectionSignal).toBe((before ?? 0) + 1)
  })

  it('writes nothing when the sheet is dismissed', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    await user.press(screen.getByTestId('sheet-dismiss'))

    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
    expect(rawRemove).not.toHaveBeenCalled()
  })
})

/**
 * The tray is a fixed-width window over a horizontally scrolling strip: two
 * verses of different colors already produce eight circles (2 remove + 6
 * apply), and the palette's worst case is twelve. `measureTray` stands in for the
 * layout pass, which never runs under jest.
 */
describe('BibleReader verse action sheet — swatch tray overflow', () => {
  beforeEach(() => {
    stubAuth()
  })

  // `fireEvent`, not `userEvent`, on purpose: `layout`, `contentSizeChange`, and
  // the scroll offset they feed are the layout pass standing in for itself, not
  // a gesture. `userEvent.scroll` would need the measurements this is supplying.
  function measureTray(trayWidth: number, contentWidth: number) {
    const scroll = screen.getByTestId('bible-verse-action-row-scroll')
    fireEvent(scroll, 'layout', { nativeEvent: { layout: { width: trayWidth } } })
    fireEvent(scroll, 'contentSizeChange', contentWidth, 56)
  }

  function scrollTray(x: number) {
    fireEvent.scroll(screen.getByTestId('bible-verse-action-row-scroll'), {
      nativeEvent: { contentOffset: { x, y: 0 } },
    })
  }

  it('draws neither fade while every swatch fits the tray', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 200)

    expect(screen.queryByTestId('bible-verse-action-row-fade-trailing')).toBeNull()
    expect(screen.queryByTestId('bible-verse-action-row-fade-leading')).toBeNull()
  })

  it('fades the trailing edge once the swatches overflow, without swallowing their taps', async () => {
    stubHighlightPermissionFlow([highlight(1, YELLOW), highlight(2, BLUE)])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 320)

    expect(screen.getByTestId('bible-verse-action-row-fade-trailing')).toBeTruthy()

    // The fade is `pointerEvents="none"`: a swatch beneath it is still live.
    await user.press(screen.getByTestId(`bible-verse-action-swatch-apply-${PINK}`))
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

    expect(screen.queryByTestId('bible-verse-action-row-fade-trailing')).toBeNull()
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

    expect(screen.queryByTestId('bible-verse-action-row-fade-leading')).toBeNull()

    scrollTray(60)

    expect(screen.getByTestId('bible-verse-action-row-fade-leading')).toBeTruthy()
  })

  it('draws both fades mid-strip, and neither swallows a swatch tap', async () => {
    stubHighlightPermissionFlow([highlight(1, YELLOW), highlight(2, BLUE)])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 320)
    scrollTray(60)

    expect(screen.getByTestId('bible-verse-action-row-fade-leading')).toBeTruthy()
    expect(screen.getByTestId('bible-verse-action-row-fade-trailing')).toBeTruthy()

    await user.press(screen.getByTestId(`bible-verse-action-swatch-apply-${PINK}`))
    expect(highlightPermissionFlowApply).toHaveBeenCalledWith(PINK, [1, 2])
  })

  /**
   * Guards a handler that zeros stored offset on remeasure. The fade arithmetic
   * itself is pinned at layer 1 in `lib/__tests__/verse-action-fade-gates.test.ts`.
   */
  it('keeps both fades after a layout pass mid-strip', async () => {
    stubHighlightPermissionFlow([highlight(1, YELLOW), highlight(2, BLUE)])
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    measureTray(200, 320)
    scrollTray(60)
    measureTray(200, 320)

    expect(screen.getByTestId('bible-verse-action-row-fade-leading')).toBeTruthy()
    expect(screen.getByTestId('bible-verse-action-row-fade-trailing')).toBeTruthy()
  })
})

/**
 * Web has no verse-action sheet. `NativeSheet` returns null there, and the
 * reader also declines to mount the sheet. The two have to agree, or a future
 * `NativeSheet` that renders on web would show a sheet on a surface this SDK
 * does not support.
 *
 * The sheet is not mounted on web. `onVerseSelect` still fires there.
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
    // on every platform.
    expect(onVerseSelect).toHaveBeenCalledWith(SELECTION)
  })
})

describe('BibleReader verse action sheet — copy and share', () => {
  it('runs copy and share off the selection payload, then clears the selection', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()
    const before = latestDomProps.clearSelectionSignal
    await user.press(screen.getByTestId('bible-verse-action-copy'))
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(SHARE_DATA.text)
    expect(latestDomProps.clearSelectionSignal).toBe((before ?? 0) + 1)
    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()

    await selectVerses()
    await user.press(screen.getByTestId('bible-verse-action-share'))
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
    await user.press(screen.getByTestId('bible-verse-action-copy'))

    await selectVerses()
    await user.press(screen.getByTestId('bible-verse-action-share'))

    expect(onCopy).toHaveBeenCalledWith(SHARE_DATA)
    expect(onShare).toHaveBeenCalledWith(SHARE_DATA)
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
    expect(Share.share).not.toHaveBeenCalled()
  })
})

const ROW_ITEM = /^bible-verse-action-(swatches|copy|share|custom-.+)$/

function rowOrder(): string[] {
  return screen
    .getAllByTestId(ROW_ITEM)
    .map((node) => String(node.props.testID).replace('bible-verse-action-', ''))
}

function customAction(
  id: string,
  onPress: BibleReaderCustomVerseAction['onPress'] = jest.fn(),
): BibleReaderCustomVerseAction {
  return { id, label: `Label ${id}`, icon: () => <View testID={`icon-${id}`} />, onPress }
}

describe('BibleReader verse action sheet — verseActions', () => {
  beforeEach(() => {
    stubAuth()
  })

  it('keeps tray, Copy, Share by default', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await selectVerses()

    expect(rowOrder()).toEqual(['swatches', 'copy', 'share'])
  })

  it('reorders built-ins and places custom actions where the host lists them', async () => {
    render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={VERSION_ID}
        verseActions={['share', customAction('save'), 'highlight', 'copy']}
      />,
      { wrapper },
    )

    await selectVerses()

    expect(rowOrder()).toEqual(['share', 'custom-save', 'swatches', 'copy'])
    expect(screen.getByTestId('icon-save')).toBeTruthy()
    expect(screen.getByLabelText('Label save')).toBeTruthy()
  })

  it('omits built-ins the host leaves out', async () => {
    render(
      <BibleReader book="JHN" chapter="1" versionId={VERSION_ID} verseActions={['copy']} />,
      { wrapper },
    )

    await selectVerses()

    expect(rowOrder()).toEqual(['copy'])
  })

  it('keeps the first of two actions with one id and warns', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const first = jest.fn()
    render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={VERSION_ID}
        verseActions={[customAction('save', first), 'copy', customAction('save'), 'copy']}
      />,
      { wrapper },
    )

    await selectVerses()
    expect(rowOrder()).toEqual(['custom-save', 'copy'])
    await user.press(screen.getByTestId('bible-verse-action-custom-save'))

    expect(first).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"save"'))
  })

  it('hands a custom action merged ranges after the sheet closes and the selection clears', async () => {
    let seenSheetOpen: boolean | null = null
    let seenSignal: number | undefined
    const onPress = jest.fn(() => {
      seenSheetOpen = screen.queryByTestId('bible-verse-action-sheet') !== null
      seenSignal = latestDomProps.clearSelectionSignal
    })
    render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={VERSION_ID}
        verseActions={[customAction('save', onPress)]}
      />,
      { wrapper },
    )

    await selectVerses({
      ...SELECTION,
      verses: [5, 1, 2, 3],
      passageIds: ['JHN.1.1', 'JHN.1.2', 'JHN.1.3', 'JHN.1.5'],
    })
    const before = latestDomProps.clearSelectionSignal ?? 0
    await user.press(screen.getByTestId('bible-verse-action-custom-save'))

    expect(onPress).toHaveBeenCalledTimes(1)
    expect(onPress).toHaveBeenCalledWith([
      {
        versionId: VERSION_ID,
        book: 'JHN',
        chapter: '1',
        verseStart: 1,
        verseEnd: 3,
        passageId: 'JHN.1.1-3',
      },
      {
        versionId: VERSION_ID,
        book: 'JHN',
        chapter: '1',
        verseStart: 5,
        verseEnd: 5,
        passageId: 'JHN.1.5',
      },
    ])
    expect(seenSheetOpen).toBe(false)
    expect(seenSignal).toBe(before + 1)
  })

  it('logs a rejected custom action instead of throwing', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const failure = new Error('host failed')
    render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={VERSION_ID}
        verseActions={[customAction('save', async () => Promise.reject(failure))]}
      />,
      { wrapper },
    )

    await selectVerses()
    await user.press(screen.getByTestId('bible-verse-action-custom-save'))

    expect(error).toHaveBeenCalledWith(expect.stringContaining('"save"'), failure)
  })

  it('opens no sheet for an empty list but still forwards the selection', async () => {
    const onVerseSelect = jest.fn(async () => undefined)
    render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={VERSION_ID}
        verseActions={[]}
        onVerseSelect={onVerseSelect}
      />,
      { wrapper },
    )

    await selectVerses()

    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(onVerseSelect).toHaveBeenCalledWith(SELECTION)
  })

  it('drops the tray from a host list when highlights are unavailable', async () => {
    testHookOverrides.useYVAuth = null
    render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={VERSION_ID}
        verseActions={['highlight', customAction('save')]}
      />,
      { wrapper },
    )

    await selectVerses()

    expect(rowOrder()).toEqual(['custom-save'])
  })
})

describe('BibleReader verse indicators — props', () => {
  it('hands the indicator resolver and tap to the reader body', () => {
    const verseIndicatorStyle: VerseIndicatorStyleResolver = () => null
    const onVerseIndicatorPress = jest.fn()
    render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={VERSION_ID}
        verseIndicatorStyle={verseIndicatorStyle}
        onVerseIndicatorPress={onVerseIndicatorPress}
      />,
      { wrapper },
    )

    expect(latestDomProps.verseIndicatorStyle).toBe(verseIndicatorStyle)
    expect(latestDomProps.onVerseIndicatorPress).toBe(onVerseIndicatorPress)
  })
})
