import { act, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Text, View, Platform } from 'react-native'

import { NativeSheet, NativeSheetProvider } from '../native-sheet'

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
      latestBottomSheetProps = props
      React.useImperativeHandle(ref, () => ({
        close: () => onChange?.(-1),
        snapToIndex: (index: number) => onChange?.(index),
      }))
      return (
        <View testID="bottom-sheet">
          {children}
        </View>
      )
    },
  )
  MockBottomSheet.displayName = 'MockBottomSheet'

  return {
    __esModule: true,
    default: MockBottomSheet,
    BottomSheetBackdrop: () => <View testID="bottom-sheet-backdrop" />,
    BottomSheetView: ({
      children,
      ...props
    }: {
      children: ReactNode
      [key: string]: unknown
    }) => (
      <View testID="bottom-sheet-view" {...props}>
        {children}
      </View>
    ),
  }
})

function SheetHarness({ isOpen }: { isOpen: boolean }) {
  return (
    <NativeSheetProvider>
      <View>
        <NativeSheet isOpen={isOpen} onClose={() => {}}>
          <Text testID="sheet-content">Sheet content</Text>
        </NativeSheet>
      </View>
    </NativeSheetProvider>
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
    expect(getByTestId('native-sheet-inert-host', { includeHiddenElements: true }).props.pointerEvents).toBe(
      'none',
    )
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
    expect(getByTestId('bottom-sheet-view', { includeHiddenElements: true }).props.pointerEvents).toBe(
      'none',
    )
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

  it('keeps inactive iOS sheet hosts mounted but inert', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
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
})
