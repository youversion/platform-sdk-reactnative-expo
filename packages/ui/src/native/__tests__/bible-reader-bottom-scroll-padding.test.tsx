import { render } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { Platform } from 'react-native'

import { IOS_TAB_BAR_CLEARANCE, READER_SCROLL_END_GAP } from '../../lib/reader-bottom-scroll-padding'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

let latestDomProps: { bottomScrollPadding?: number } = {}

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
  SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
  SafeAreaView: ({ children }: { children: ReactNode }) => children,
}))

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: { bottomScrollPadding?: number }) {
      latestDomProps = props
      return <View testID="mock-dom" />
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

jest.mock('../native-sheet', () => {
  const actual = jest.requireActual('../native-sheet')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    ...actual,
    NativeSheet: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
      isOpen ? <View testID="sheet">{children}</View> : null,
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

jest.mock('../../stores/reader-settings-store', () => ({
  useReaderSettingsStore: () => ({
    fontSize: 16,
    fontFamily: '"Inter", sans-serif',
    lineSpacing: 1.625,
    setFontSize: jest.fn(),
    setFontFamily: jest.fn(),
    setLineSpacing: jest.fn(),
  }),
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

describe('BibleReader bottom scroll padding', () => {
  beforeEach(() => {
    latestDomProps = {}
  })

  it('passes computed bottomScrollPadding to the DOM wrapper on iOS', () => {
    const originalOS = Platform.OS
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' })

    render(<BibleReader />, { wrapper })

    expect(latestDomProps.bottomScrollPadding).toBe(
      IOS_TAB_BAR_CLEARANCE + 34 + READER_SCROLL_END_GAP,
    )

    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS })
  })
})
