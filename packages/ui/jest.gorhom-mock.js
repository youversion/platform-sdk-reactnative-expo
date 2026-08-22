'use strict'

/**
 * Shared Gorhom mock for UI tests. NativeSheet default-imports BottomSheet;
 * the official CJS mock is a namespace object unless `__esModule` is set, which
 * React then tries to mount ("got: object"). This factory returns a capturing
 * forwardRef default plus BottomSheetView/Backdrop that keep the testIDs the
 * NativeSheet suite asserts on.
 */

const React = require('react')
const { View } = require('react-native')

const latestBottomSheetProps = {}

function resetLatestBottomSheetProps() {
  for (const key of Object.keys(latestBottomSheetProps)) {
    delete latestBottomSheetProps[key]
  }
}

const MockBottomSheet = React.forwardRef(
  ({ children, onChange, onAnimate, ...props }, ref) => {
    resetLatestBottomSheetProps()
    Object.assign(latestBottomSheetProps, { ...props, onChange, onAnimate })
    React.useImperativeHandle(ref, () => ({
      close: () => {
        onAnimate?.(0, -1)
        onChange?.(-1)
      },
      snapToIndex: (index) => onChange?.(index),
    }))
    return React.createElement(View, { testID: 'bottom-sheet' }, children)
  },
)
MockBottomSheet.displayName = 'MockBottomSheet'

function createGorhomMock() {
  const Gorhom = require('@gorhom/bottom-sheet/mock')
  return {
    __esModule: true,
    ...Gorhom,
    default: MockBottomSheet,
    BottomSheetBackdrop: ({ onPress, ...props }) =>
      React.createElement(View, {
        testID: 'bottom-sheet-backdrop',
        ...props,
        onTouchEnd: () => {
          onPress?.()
        },
      }),
    BottomSheetView: ({ children, ...props }) =>
      React.createElement(View, { testID: 'bottom-sheet-view', ...props }, children),
  }
}

module.exports = {
  createGorhomMock,
  latestBottomSheetProps,
  resetLatestBottomSheetProps,
}
