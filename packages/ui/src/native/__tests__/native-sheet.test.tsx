import { act, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Text, View, Platform } from 'react-native'

import { NativeSheet, NativeSheetProvider } from '../native-sheet'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}))

jest.mock('@rn-primitives/portal', () => ({
  Portal: ({ children }: { children: ReactNode }) => <>{children}</>,
  PortalHost: () => null,
}))

jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react')
  const { View } = require('react-native')

  const BottomSheet = React.forwardRef(
    (
      {
        children,
        onChange,
      }: {
        children: ReactNode
        onChange?: (index: number) => void
      },
      ref: React.Ref<{ close: () => void; snapToIndex: (index: number) => void }>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        close: () => onChange?.(-1),
        snapToIndex: (index: number) => onChange?.(index),
      }))
      return <View testID="bottom-sheet">{children}</View>
    },
  )

  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetBackdrop: () => null,
    BottomSheetView: ({ children }: { children: ReactNode }) => (
      <View testID="bottom-sheet-view">{children}</View>
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

  afterEach(() => {
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

  it('suppresses inactive sheet hosts on Android 12 and below', () => {
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

    const { queryByTestId } = render(<SheetHarness isOpen={false} />)

    expect(queryByTestId('bottom-sheet')).toBeNull()
  })

  it('mounts suppressed Android 12 sheet hosts when active', async () => {
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

    const { getByTestId, rerender } = render(<SheetHarness isOpen={false} />)

    await act(async () => {
      rerender(<SheetHarness isOpen={true} />)
    })

    expect(getByTestId('bottom-sheet')).toBeTruthy()
    expect(getByTestId('sheet-content')).toBeTruthy()
  })

  it('keeps inactive sheet hosts mounted on newer Android for WebView pre-warming', () => {
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

    const { getByTestId } = render(<SheetHarness isOpen={false} />)

    expect(getByTestId('bottom-sheet')).toBeTruthy()
    expect(getByTestId('sheet-content')).toBeTruthy()
  })

  it('keeps inactive sheet hosts mounted on iOS for WebView pre-warming', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'ios',
    })

    const { getByTestId } = render(<SheetHarness isOpen={false} />)

    expect(getByTestId('bottom-sheet')).toBeTruthy()
    expect(getByTestId('sheet-content')).toBeTruthy()
  })
})
