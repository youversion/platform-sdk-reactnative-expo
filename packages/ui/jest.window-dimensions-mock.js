'use strict'

/**
 * Mutable window size for UI tests. NativeSheet reads `useWindowDimensions`
 * from react-native; that export is a getter over this module, so a file-level
 * `jest.spyOn(ReactNative, 'useWindowDimensions')` never reaches it.
 */

const mockWindowDimensions = {
  width: 750,
  height: 1334,
  scale: 2,
  fontScale: 1,
}

function mockUseWindowDimensions() {
  return {
    width: mockWindowDimensions.width,
    height: mockWindowDimensions.height,
    scale: mockWindowDimensions.scale,
    fontScale: mockWindowDimensions.fontScale,
  }
}

function resetMockWindowDimensions() {
  mockWindowDimensions.width = 750
  mockWindowDimensions.height = 1334
  mockWindowDimensions.scale = 2
  mockWindowDimensions.fontScale = 1
}

module.exports = {
  mockWindowDimensions,
  mockUseWindowDimensions,
  resetMockWindowDimensions,
}
