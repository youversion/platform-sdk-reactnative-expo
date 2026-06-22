import { act, render, userEvent } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Platform, Text, View } from 'react-native'

import { SHEET_HANDLE, SHEET_SURFACE } from '../../lib/native-sheet-theme'
import { NativeSheet } from '../native-sheet'
import { YouVersionProvider } from '../youversion-provider'

jest.mock('@youversion/platform-react-native-expo-core', () => ({
  YouVersionProvider: ({ children }: { children: ReactNode }) => children,
}))

let latestBottomSheetProps: Record<string, unknown> = {}
let mockBottomInset = 0

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: mockBottomInset }),
}))

jest.mock('@rn-primitives/portal', () => ({
  Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
  PortalHost: () => null,
}))

jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')

  const MockBottomSheet = React.forwardRef(
    (
      {
        children,
        onChange,
        ...props
      }: {
        children: ReactNode
        onChange?: (index: number) => void
        [key: string]: unknown
      },
      ref: React.Ref<{ close: () => void; snapToIndex: (index: number) => void }>,
    ) => {
      // Module-level mutable capture cell for the latest render's props —
      // intentional test infra, so the react-hooks/globals rule is scoped off
      // for this assignment.
      // eslint-disable-next-line react-hooks/globals
      latestBottomSheetProps = props
      React.useImperativeHandle(ref, () => ({
        close: () => onChange?.(-1),
        snapToIndex: (index: number) => onChange?.(index),
      }))
      return <View testID="bottom-sheet">{children}</View>
    },
  )
  MockBottomSheet.displayName = 'MockBottomSheet'

  return {
    __esModule: true,
    default: MockBottomSheet,
    BottomSheetBackdrop: () => <View testID="bottom-sheet-backdrop" />,
    BottomSheetView: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
      <View testID="bottom-sheet-view" {...props}>
        {children}
      </View>
    ),
  }
})

function SheetProvider({ children }: { children: ReactNode }) {
  return <YouVersionProvider appKey="test-key">{children}</YouVersionProvider>
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
    return BackdropComponent?.({})
  }

  afterEach(() => {
    latestBottomSheetProps = {}
    mockBottomInset = 0
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

    expect(latestBottomSheetProps.backgroundStyle).toEqual({ backgroundColor: '#1f1d1d' })
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
})
