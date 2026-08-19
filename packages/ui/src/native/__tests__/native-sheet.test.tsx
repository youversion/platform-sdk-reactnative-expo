import { act, render, userEvent } from '@testing-library/react-native'
import type { ReactElement, ReactNode } from 'react'
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import {
  latestBottomSheetProps,
  resetLatestBottomSheetProps,
} from '../../../jest.gorhom-mock'
import {
  mockWindowDimensions,
  resetMockWindowDimensions,
} from '../../../jest.window-dimensions-mock'
import { SHEET_MAX_WIDTH } from '../../lib/native-sheet-max-width'
import { SHEET_HANDLE, SHEET_SURFACE, SHEET_TOP_SHADOW } from '../../lib/native-sheet-theme'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { resetImpls } from '../../test-utils/install-test-impls'
import { NativeSheet } from '../native-sheet'
import { YouVersionProvider } from '../youversion-provider'

let mockBottomInset = 0
let mockWindowWidth = 390

function SheetProvider({ children }: { children: ReactNode }) {
  mockWindowDimensions.width = mockWindowWidth
  mockWindowDimensions.height = 844
  mockWindowDimensions.scale = 2
  mockWindowDimensions.fontScale = 1
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: mockWindowWidth, height: 844 },
        insets: { top: 0, right: 0, bottom: mockBottomInset, left: 0 },
      }}
    >
      <YouVersionProvider appKey="test-key" hookOverrides={defaultHookOverrides}>
        {children}
      </YouVersionProvider>
    </SafeAreaProvider>
  )
}

function SheetHarness({ isOpen }: { isOpen: boolean }) {
  return (
    <SheetProvider>
      <View>
        <NativeSheet isOpen={isOpen} onClose={() => {}}>
          <Text testID="sheet-content">Sheet content</Text>
        </NativeSheet>
      </View>
    </SheetProvider>
  )
}

function TwoSheetHarness({
  isOpenA,
  isOpenB,
  onCloseA,
  onCloseB,
}: {
  isOpenA: boolean
  isOpenB: boolean
  onCloseA: () => void
  onCloseB: () => void
}) {
  return (
    <SheetProvider>
      <View>
        <NativeSheet isOpen={isOpenA} onClose={onCloseA}>
          <Text testID="sheet-a-content">A</Text>
        </NativeSheet>
        <NativeSheet isOpen={isOpenB} onClose={onCloseB}>
          <Text testID="sheet-b-content">B</Text>
        </NativeSheet>
      </View>
    </SheetProvider>
  )
}

describe('NativeSheet', () => {
  const originalOs = Platform.OS
  const originalVersion = Platform.Version
  const renderLatestBackdrop = () => {
    const BackdropComponent = latestBottomSheetProps.backdropComponent as
      | ((props: Record<string, unknown>) => ReactNode)
      | undefined
    return BackdropComponent?.({ animatedIndex: { value: 0 } })
  }

  afterEach(() => {
    resetLatestBottomSheetProps()
    resetMockWindowDimensions()
    mockBottomInset = 0
    mockWindowWidth = 390
    resetImpls()
    jest.restoreAllMocks()
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: originalOs,
    })
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      enumerable: true,
      value: originalVersion,
    })
  })

  it('keeps inactive Android 12 sheet hosts mounted but inert', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'android',
    })
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      enumerable: true,
      value: 31,
    })

    mockBottomInset = 24

    const { getByTestId } = render(<SheetHarness isOpen={false} />)

    expect(getByTestId('bottom-sheet', { includeHiddenElements: true })).toBeTruthy()
    expect(getByTestId('sheet-content', { includeHiddenElements: true })).toBeTruthy()
    expect(
      getByTestId('native-sheet-inert-host', { includeHiddenElements: true }).props.pointerEvents,
    ).toBe('none')
    expect(
      getByTestId('native-sheet-inert-host', { includeHiddenElements: true }).props
        .accessibilityElementsHidden,
    ).toBe(true)
    expect(
      getByTestId('native-sheet-inert-host', { includeHiddenElements: true }).props
        .importantForAccessibility,
    ).toBe('no-hide-descendants')
    expect(latestBottomSheetProps.detached).toBe(true)
    expect(latestBottomSheetProps.bottomInset).toBe(24)
    expect(latestBottomSheetProps.containerStyle).toEqual({ transform: [{ translateY: 1000 }] })
    expect(latestBottomSheetProps.handleComponent).toBeNull()
    expect(typeof latestBottomSheetProps.backdropComponent).toBe('function')
    expect(renderLatestBackdrop()).toBeNull()
    expect(latestBottomSheetProps.backgroundComponent).toBeNull()
    expect(latestBottomSheetProps.enablePanDownToClose).toBe(false)
    expect(latestBottomSheetProps.enableHandlePanningGesture).toBe(false)
    expect(latestBottomSheetProps.enableContentPanningGesture).toBe(false)
    expect(latestBottomSheetProps.accessible).toBe(false)
    expect(latestBottomSheetProps.accessibilityElementsHidden).toBe(true)
    expect(latestBottomSheetProps.importantForAccessibility).toBe('no-hide-descendants')
    expect(
      getByTestId('bottom-sheet-view', { includeHiddenElements: true }).props.pointerEvents,
    ).toBe('none')
    expect(
      getByTestId('bottom-sheet-view', { includeHiddenElements: true }).props
        .accessibilityElementsHidden,
    ).toBe(true)
  })

  it('restores sheet chrome and gestures when Android 12 sheets become active', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'android',
    })
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      enumerable: true,
      value: 31,
    })

    mockBottomInset = 24

    const { getByTestId, rerender } = render(<SheetHarness isOpen={false} />)

    await act(async () => {
      rerender(<SheetHarness isOpen={true} />)
    })

    expect(getByTestId('bottom-sheet')).toBeTruthy()
    expect(getByTestId('sheet-content')).toBeTruthy()
    expect(getByTestId('native-sheet-inert-host').props.pointerEvents).toBe('auto')
    expect(getByTestId('native-sheet-inert-host').props.accessibilityElementsHidden).toBe(false)
    expect(getByTestId('native-sheet-inert-host').props.importantForAccessibility).toBe('auto')
    expect(latestBottomSheetProps.detached).toBe(false)
    expect(latestBottomSheetProps.bottomInset).toBe(0)
    expect(latestBottomSheetProps.containerStyle).toBeUndefined()
    expect(latestBottomSheetProps.handleComponent).toBeUndefined()
    expect(typeof latestBottomSheetProps.backdropComponent).toBe('function')
    expect(renderLatestBackdrop()).toBeTruthy()
    expect(latestBottomSheetProps.backgroundComponent).toBeUndefined()
    expect(latestBottomSheetProps.enablePanDownToClose).toBe(true)
    expect(latestBottomSheetProps.enableHandlePanningGesture).toBe(true)
    expect(latestBottomSheetProps.enableContentPanningGesture).toBe(true)
    expect(latestBottomSheetProps.accessible).toBe(true)
    expect(latestBottomSheetProps.accessibilityElementsHidden).toBe(false)
    expect(latestBottomSheetProps.importantForAccessibility).toBe('auto')
    expect(getByTestId('bottom-sheet-view').props.pointerEvents).toBe('auto')
    expect(getByTestId('bottom-sheet-view').props.accessibilityElementsHidden).toBe(false)
  })

  it('keeps inactive newer Android sheet hosts mounted but inert', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'android',
    })
    Object.defineProperty(Platform, 'Version', {
      configurable: true,
      enumerable: true,
      value: 34,
    })

    mockBottomInset = 24

    const { getByTestId } = render(<SheetHarness isOpen={false} />)

    expect(getByTestId('bottom-sheet', { includeHiddenElements: true })).toBeTruthy()
    expect(getByTestId('sheet-content', { includeHiddenElements: true })).toBeTruthy()
    expect(latestBottomSheetProps.detached).toBe(true)
    expect(latestBottomSheetProps.bottomInset).toBe(24)
    expect(latestBottomSheetProps.handleComponent).toBeNull()
    expect(typeof latestBottomSheetProps.backdropComponent).toBe('function')
    expect(renderLatestBackdrop()).toBeNull()
  })

  it('keeps inactive iOS sheet hosts mounted with default chrome to preserve WebView pre-warming', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
    })

    mockBottomInset = 24

    const { getByTestId } = render(<SheetHarness isOpen={false} />)

    expect(getByTestId('bottom-sheet', { includeHiddenElements: true })).toBeTruthy()
    expect(getByTestId('sheet-content', { includeHiddenElements: true })).toBeTruthy()
    // box-none so the absoluteFill wrapper never swallows taps on the underlying app
    expect(
      getByTestId('native-sheet-inert-host', { includeHiddenElements: true }).props.pointerEvents,
    ).toBe('box-none')
    expect(
      getByTestId('native-sheet-inert-host', { includeHiddenElements: true }).props
        .accessibilityElementsHidden,
    ).toBe(false)
    expect(
      getByTestId('native-sheet-inert-host', { includeHiddenElements: true }).props
        .importantForAccessibility,
    ).toBe('auto')
    expect(latestBottomSheetProps.detached).toBe(false)
    expect(latestBottomSheetProps.bottomInset).toBe(0)
    expect(latestBottomSheetProps.containerStyle).toBeUndefined()
    expect(latestBottomSheetProps.handleComponent).toBeUndefined()
    expect(latestBottomSheetProps.backgroundComponent).toBeUndefined()
    expect(typeof latestBottomSheetProps.backdropComponent).toBe('function')
    expect(renderLatestBackdrop()).toBeTruthy()
    expect(latestBottomSheetProps.enablePanDownToClose).toBe(true)
    expect(latestBottomSheetProps.enableHandlePanningGesture).toBe(true)
    expect(latestBottomSheetProps.enableContentPanningGesture).toBe(true)
    expect(latestBottomSheetProps.accessible).toBe(true)
    expect(latestBottomSheetProps.accessibilityElementsHidden).toBe(false)
    expect(latestBottomSheetProps.importantForAccessibility).toBe('auto')
    expect(
      getByTestId('bottom-sheet-view', { includeHiddenElements: true }).props.pointerEvents,
    ).toBe('auto')
    expect(
      getByTestId('bottom-sheet-view', { includeHiddenElements: true }).props
        .accessibilityElementsHidden,
    ).toBe(false)
  })

  it('themes the sheet background and handle indicator from the theme prop', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
    })

    render(
      <SheetProvider>
        <View>
          <NativeSheet isOpen={true} onClose={() => {}} theme="dark">
            <Text testID="sheet-content">Sheet content</Text>
          </NativeSheet>
        </View>
      </SheetProvider>,
    )

    expect(latestBottomSheetProps.backgroundStyle).toEqual({
      backgroundColor: '#121212',
      boxShadow: SHEET_TOP_SHADOW.dark,
    })
    expect(latestBottomSheetProps.handleIndicatorStyle).toEqual([
      { backgroundColor: '#ccc' },
      { backgroundColor: '#5a5757' },
    ])
  })

  it('prefers an explicit backgroundColor over the themed surface', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
    })

    render(
      <SheetProvider>
        <View>
          <NativeSheet isOpen={true} onClose={() => {}} theme="dark" backgroundColor="#123456">
            <Text testID="sheet-content">Sheet content</Text>
          </NativeSheet>
        </View>
      </SheetProvider>,
    )

    expect(latestBottomSheetProps.backgroundStyle).toEqual({
      backgroundColor: '#123456',
      boxShadow: SHEET_TOP_SHADOW.dark,
    })
  })

  it('omits the top shadow when a backgroundColor is given with no theme to color it', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
    })

    render(
      <SheetProvider>
        <View>
          <NativeSheet isOpen={true} onClose={() => {}} backgroundColor="#123456">
            <Text testID="sheet-content">Sheet content</Text>
          </NativeSheet>
        </View>
      </SheetProvider>,
    )

    expect(latestBottomSheetProps.backgroundStyle).toEqual({ backgroundColor: '#123456' })
  })

  it('leaves the sheet background unthemed when no theme or backgroundColor is given', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
    })

    render(<SheetHarness isOpen={true} />)

    expect(latestBottomSheetProps.backgroundStyle).toBeUndefined()
    expect(latestBottomSheetProps.handleIndicatorStyle).toEqual({ backgroundColor: '#ccc' })
  })

  /**
   * A non-modal sheet drops the backdrop component outright rather than making
   * it invisible. Gorhom's backdrop reads `enableTouchThrough` only for its
   * initial `pointerEvents`, then an animated reaction overwrites it to 'auto'
   * once the sheet opens — so an invisible backdrop would still eat every tap on
   * the content behind. Rendering nothing is the only version that works.
   */
  it('renders no backdrop when modal is false', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
    })

    render(
      <SheetProvider>
        <View>
          <NativeSheet isOpen={true} onClose={() => {}} modal={false}>
            <Text testID="sheet-content">Sheet content</Text>
          </NativeSheet>
        </View>
      </SheetProvider>,
    )

    expect(typeof latestBottomSheetProps.backdropComponent).toBe('function')
    expect(renderLatestBackdrop()).toBeNull()
  })

  /**
   * `panActiveOffsetY` is how a sheet keeps a horizontally scrolling child
   * usable on Android. Gorhom leaves `activeOffsetY` unset, which drops RNGH's
   * pan back to a direction-agnostic touch slop — the sheet then claims sideways
   * drags and cancels the nested scrollable's touches. Supplying a vertical-only
   * threshold is what keeps swipe-down *and* the scroll, so both the default
   * (absent) and the forwarded value are pinned here.
   */
  it('leaves the sheet pan unconstrained by default', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
    })

    render(<SheetHarness isOpen={true} />)

    expect(latestBottomSheetProps.activeOffsetY).toBeUndefined()
    expect(latestBottomSheetProps.enableContentPanningGesture).toBe(true)
  })

  it('forwards panActiveOffsetY to the Gorhom pan as activeOffsetY', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
    })

    render(
      <SheetProvider>
        <View>
          <NativeSheet isOpen={true} onClose={() => {}} panActiveOffsetY={[-10, 10]}>
            <Text testID="sheet-content">Sheet content</Text>
          </NativeSheet>
        </View>
      </SheetProvider>,
    )

    expect(latestBottomSheetProps.activeOffsetY).toEqual([-10, 10])
    // Constraining activation must not be confused with disabling the gesture:
    // `enableContentPanningGesture={false}` would take swipe-down with it.
    expect(latestBottomSheetProps.enableContentPanningGesture).toBe(true)
  })

  /**
   * Android's active host is normally `auto`, which would put the dropped
   * backdrop's job back on the absoluteFill wrapper. `box-none` lets the taps
   * through to the content behind while the sheet itself stays interactive.
   */
  it('lets taps through the Android host wrapper when modal is false', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'android',
    })

    const { getByTestId } = render(
      <SheetProvider>
        <View>
          <NativeSheet isOpen={true} onClose={() => {}} modal={false}>
            <Text testID="sheet-content">Sheet content</Text>
          </NativeSheet>
        </View>
      </SheetProvider>,
    )

    await act(async () => {})

    expect(getByTestId('native-sheet-inert-host').props.pointerEvents).toBe('box-none')
  })

  it('notifies a displaced sheet via onClose when another sheet claims activeSheetId', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
    })

    const onCloseA = jest.fn()
    const onCloseB = jest.fn()

    const { rerender } = render(
      <TwoSheetHarness isOpenA={false} isOpenB={false} onCloseA={onCloseA} onCloseB={onCloseB} />,
    )

    // Open A from closed state.
    await act(async () => {
      rerender(
        <TwoSheetHarness isOpenA={true} isOpenB={false} onCloseA={onCloseA} onCloseB={onCloseB} />,
      )
    })
    expect(onCloseA).not.toHaveBeenCalled()

    // Open B while A's parent still considers A open. B steals activeSheetId.
    // Without the displacement fix A's parent never learns its sheet closed and
    // its boolean stays out of sync with reality, so a later tap on A's trigger
    // sets the same boolean and React skips the update.
    await act(async () => {
      rerender(
        <TwoSheetHarness isOpenA={true} isOpenB={true} onCloseA={onCloseA} onCloseB={onCloseB} />,
      )
    })

    expect(onCloseA).toHaveBeenCalledTimes(1)
    expect(onCloseB).not.toHaveBeenCalled()
  })

  it('does not call onClose when the parent itself closes the sheet', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
    })

    const onClose = jest.fn()

    function Harness({ isOpen }: { isOpen: boolean }) {
      return (
        <SheetProvider>
          <View>
            <NativeSheet isOpen={isOpen} onClose={onClose}>
              <Text testID="sheet-content">Sheet content</Text>
            </NativeSheet>
          </View>
        </SheetProvider>
      )
    }

    const { rerender } = render(<Harness isOpen={false} />)

    await act(async () => {
      rerender(<Harness isOpen={true} />)
    })
    expect(onClose).not.toHaveBeenCalled()

    // Parent flips isOpen to false — no displacement, no notification needed.
    await act(async () => {
      rerender(<Harness isOpen={false} />)
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  describe('loader (Android only)', () => {
    function LoaderHarness({
      isOpen,
      showAndroidLoader,
    }: {
      isOpen: boolean
      showAndroidLoader?: boolean
    }) {
      return (
        <SheetProvider>
          <View>
            <NativeSheet isOpen={isOpen} onClose={() => {}} showAndroidLoader={showAndroidLoader}>
              <Text testID="sheet-content">Sheet content</Text>
            </NativeSheet>
          </View>
        </SheetProvider>
      )
    }

    const fireContentLayout = (
      node: { props: { onLayout?: (e: unknown) => void } },
      height: number,
    ) => {
      node.props.onLayout?.({ nativeEvent: { layout: { width: 320, height, x: 0, y: 0 } } })
    }

    const setPlatform = (os: 'ios' | 'android') => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        enumerable: true,
        value: os,
      })
    }

    it('does not render a loader by default', async () => {
      setPlatform('android')

      const { queryByTestId, rerender } = render(<LoaderHarness isOpen={false} />)

      await act(async () => {
        rerender(<LoaderHarness isOpen={true} />)
      })

      expect(queryByTestId('native-sheet-loader', { includeHiddenElements: true })).toBeNull()
    })

    it('renders the loader and holds the wrapper at loaderMinHeight while the sheet is active on Android', async () => {
      setPlatform('android')

      const { getByTestId, queryByTestId, rerender } = render(
        <LoaderHarness isOpen={false} showAndroidLoader />,
      )

      // Inactive: no loader rendered (loader only mounts while the sheet is opening/open).
      expect(queryByTestId('native-sheet-loader', { includeHiddenElements: true })).toBeNull()

      await act(async () => {
        rerender(<LoaderHarness isOpen={true} showAndroidLoader />)
      })

      expect(getByTestId('native-sheet-loader')).toBeTruthy()
      // The wrapper around the content gets a minHeight floor so the sheet snaps
      // to a stable initial pose instead of zero.
      expect(getByTestId('native-sheet-loader-wrapper').props.style).toMatchObject({
        minHeight: 180,
      })
    })

    it('hides the loader once content reports a non-trivial layout height', async () => {
      setPlatform('android')

      const { getByTestId, queryByTestId, rerender } = render(
        <LoaderHarness isOpen={false} showAndroidLoader />,
      )

      await act(async () => {
        rerender(<LoaderHarness isOpen={true} showAndroidLoader />)
      })
      expect(getByTestId('native-sheet-loader')).toBeTruthy()

      // A trivial height (e.g. 0 from the wrapping View before the WebView has
      // laid out) must not flip the loader off.
      await act(async () => {
        fireContentLayout(getByTestId('native-sheet-content'), 0)
      })
      expect(getByTestId('native-sheet-loader')).toBeTruthy()

      // Once the WebView reports its real content size, the loader hides and
      // the min-height floor drops so enableDynamicSizing can resize the sheet.
      await act(async () => {
        fireContentLayout(getByTestId('native-sheet-content'), 280)
      })
      expect(queryByTestId('native-sheet-loader', { includeHiddenElements: true })).toBeNull()
    })

    it('skips the loader on iOS even when showAndroidLoader is true (iOS pre-warms via the inert-host exception)', async () => {
      setPlatform('ios')

      const { queryByTestId, rerender } = render(<LoaderHarness isOpen={false} showAndroidLoader />)

      await act(async () => {
        rerender(<LoaderHarness isOpen={true} showAndroidLoader />)
      })

      expect(queryByTestId('native-sheet-loader', { includeHiddenElements: true })).toBeNull()
    })
  })

  describe('theme styling', () => {
    const cases = [
      { theme: 'light' as const, text: 'black' },
      { theme: 'dark' as const, text: 'white' },
    ]

    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        enumerable: true,
        value: 'ios',
      })
    })

    it.each(cases)('themes the sheet chrome for the $theme theme', ({ theme }) => {
      render(
        <SheetProvider>
          <View>
            <NativeSheet isOpen={true} onClose={() => {}} theme={theme}>
              <Text testID="sheet-content">Sheet content</Text>
            </NativeSheet>
          </View>
        </SheetProvider>,
      )

      expect(latestBottomSheetProps.backgroundStyle).toEqual({
        backgroundColor: SHEET_SURFACE[theme],
        boxShadow: SHEET_TOP_SHADOW[theme],
      })
      expect(latestBottomSheetProps.handleIndicatorStyle).toEqual([
        { backgroundColor: '#ccc' },
        { backgroundColor: SHEET_HANDLE[theme] },
      ])
    })

    it.each(cases)('themes the header text for the $theme theme', ({ theme, text }) => {
      const { getByText } = render(
        <SheetProvider>
          <View>
            <NativeSheet
              isOpen={true}
              onClose={() => {}}
              theme={theme}
              showHeader
              headerTitle="Versions"
            >
              <Text testID="sheet-content">Sheet content</Text>
            </NativeSheet>
          </View>
        </SheetProvider>,
      )

      expect(getByText('Versions').props.style).toMatchObject({ color: text })
      expect(getByText('Cancel').props.style).toMatchObject({ color: text })
    })
  })

  describe('header', () => {
    function HeaderHarness({
      showHeader,
      headerTitle,
      theme,
      onClose = () => {},
    }: {
      showHeader?: boolean
      headerTitle?: string
      theme?: 'light' | 'dark'
      onClose?: () => void
    }) {
      return (
        <SheetProvider>
          <View>
            <NativeSheet
              isOpen={true}
              onClose={onClose}
              theme={theme}
              showHeader={showHeader}
              headerTitle={headerTitle}
            >
              <Text testID="sheet-content">Sheet content</Text>
            </NativeSheet>
          </View>
        </SheetProvider>
      )
    }

    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        enumerable: true,
        value: 'ios',
      })
    })

    it('does not render the header by default', () => {
      const { queryByText } = render(<SheetHarness isOpen={true} />)

      expect(queryByText('Cancel')).toBeNull()
    })

    it('renders the title and a Cancel control when showHeader is true', () => {
      const { getByText } = render(<HeaderHarness showHeader headerTitle="Choose a version" />)

      expect(getByText('Choose a version')).toBeTruthy()
      expect(getByText('Cancel')).toBeTruthy()
    })

    it('renders the Cancel control even without a headerTitle', () => {
      const { getByText, queryByText } = render(<HeaderHarness showHeader />)

      expect(getByText('Cancel')).toBeTruthy()
      expect(queryByText('Choose a version')).toBeNull()
    })

    it('calls onClose when the Cancel control is pressed', async () => {
      const onClose = jest.fn()
      const user = userEvent.setup()
      const { getByText } = render(
        <HeaderHarness showHeader headerTitle="Choose a version" onClose={onClose} />,
      )

      await user.press(getByText('Cancel'))

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('uses dark header text colors when the theme is dark', () => {
      const { getByText } = render(
        <HeaderHarness showHeader headerTitle="Choose a version" theme="dark" />,
      )

      expect(getByText('Choose a version').props.style).toMatchObject({ color: 'white' })
      expect(getByText('Cancel').props.style).toMatchObject({ color: 'white' })
    })

    it('uses light header text colors when the theme is not dark', () => {
      const { getByText } = render(
        <HeaderHarness showHeader headerTitle="Choose a version" theme="light" />,
      )

      expect(getByText('Choose a version').props.style).toMatchObject({ color: 'black' })
      expect(getByText('Cancel').props.style).toMatchObject({ color: 'black' })
    })
  })

  describe('bottom inset', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        enumerable: true,
        value: 'ios',
      })
      mockBottomInset = 24
    })

    it('colors the safe-area footer with bottomInsetColor', () => {
      const { getByTestId } = render(
        <SheetProvider>
          <View>
            <NativeSheet isOpen={true} onClose={() => {}} bottomInsetColor="#f6f4f4">
              <Text testID="sheet-content">Sheet content</Text>
            </NativeSheet>
          </View>
        </SheetProvider>,
      )

      expect(getByTestId('native-sheet-bottom-inset').props.style).toMatchObject({
        height: 24,
        backgroundColor: '#f6f4f4',
      })
    })

    it('leaves the footer uncolored (matching the surface) when no bottomInsetColor is given', () => {
      const { getByTestId } = render(
        <SheetProvider>
          <View>
            <NativeSheet isOpen={true} onClose={() => {}} theme="light">
              <Text testID="sheet-content">Sheet content</Text>
            </NativeSheet>
          </View>
        </SheetProvider>,
      )

      const style = getByTestId('native-sheet-bottom-inset').props.style
      expect(style).toMatchObject({ height: 24 })
      expect(style.backgroundColor).toBeUndefined()
    })

    it('omits the footer when there is no safe-area inset', () => {
      mockBottomInset = 0

      const { queryByTestId } = render(
        <SheetProvider>
          <View>
            <NativeSheet isOpen={true} onClose={() => {}} bottomInsetColor="#f6f4f4">
              <Text testID="sheet-content">Sheet content</Text>
            </NativeSheet>
          </View>
        </SheetProvider>,
      )

      expect(queryByTestId('native-sheet-bottom-inset')).toBeNull()
    })
  })

  describe('wide-screen width cap', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        enumerable: true,
        value: 'ios',
      })
    })

    const flattenedSheetStyle = () =>
      StyleSheet.flatten(latestBottomSheetProps.style as StyleProp<ViewStyle>)

    it('does not add horizontal margins on phone-width windows', () => {
      mockWindowWidth = 390

      render(<SheetHarness isOpen={true} />)

      expect(flattenedSheetStyle().marginHorizontal).toBeUndefined()
    })

    it('caps and centers the sheet surface on wide windows (iPad)', () => {
      mockWindowWidth = 1024

      render(<SheetHarness isOpen={true} />)

      expect(flattenedSheetStyle().marginHorizontal).toBe((1024 - SHEET_MAX_WIDTH) / 2)
    })

    it('caps inactive pre-warmed hosts too, so WebViews measure at the final width', () => {
      mockWindowWidth = 1024

      render(<SheetHarness isOpen={false} />)

      expect(flattenedSheetStyle().marginHorizontal).toBe((1024 - SHEET_MAX_WIDTH) / 2)
    })
  })

  describe('dismiss keyboard start', () => {
    beforeEach(() => {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        enumerable: true,
        value: 'ios',
      })
    })

    it('calls onDismissKeyboardStart once when the backdrop is pressed', async () => {
      const onDismissKeyboardStart = jest.fn()

      render(
        <SheetProvider>
          <View>
            <NativeSheet
              isOpen={true}
              onClose={() => {}}
              onDismissKeyboardStart={onDismissKeyboardStart}
            >
              <Text testID="sheet-content">Sheet content</Text>
            </NativeSheet>
          </View>
        </SheetProvider>,
      )

      const backdrop = renderLatestBackdrop() as ReactElement<{ onPress?: () => void }>
      expect(backdrop).toBeTruthy()

      const onAnimate = latestBottomSheetProps.onAnimate as
        | ((fromIndex: number, toIndex: number) => void)
        | undefined

      // Backdrop press closes the sheet: pressBehavior="close" triggers onAnimate(0, -1).
      await act(async () => {
        backdrop.props.onPress?.()
        onAnimate?.(0, -1)
      })

      expect(onDismissKeyboardStart).toHaveBeenCalledTimes(1)
    })

    it('calls onDismissKeyboardStart when a pan-down close animation begins', async () => {
      const onDismissKeyboardStart = jest.fn()

      render(
        <SheetProvider>
          <View>
            <NativeSheet
              isOpen={true}
              onClose={() => {}}
              onDismissKeyboardStart={onDismissKeyboardStart}
            >
              <Text testID="sheet-content">Sheet content</Text>
            </NativeSheet>
          </View>
        </SheetProvider>,
      )

      const onAnimate = latestBottomSheetProps.onAnimate as
        | ((fromIndex: number, toIndex: number) => void)
        | undefined

      await act(async () => {
        onAnimate?.(0, -1)
      })

      expect(onDismissKeyboardStart).toHaveBeenCalledTimes(1)
    })
  })
})
