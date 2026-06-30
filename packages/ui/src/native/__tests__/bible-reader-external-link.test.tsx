import { act, fireEvent, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

const mockOpenBrowserAsync = jest.fn().mockResolvedValue(undefined)
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: (...args: unknown[]) => mockOpenBrowserAsync(...args),
}))

// @expo/dom-webview does not fire react-native-webview's `onOpenWindow`, so the
// DOM component intercepts outbound link clicks and calls `onExternalLinkPress`
// across the bridge. The mock exposes a trigger to exercise that contract.
let latestDomProps: { onExternalLinkPress?: (url: string) => Promise<void> } = {}

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Pressable, Text } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: { onExternalLinkPress?: (url: string) => Promise<void> }) {
      latestDomProps = props
      return (
        <View testID="mock-dom">
          <Pressable
            testID="trigger-external-link"
            onPress={() => props.onExternalLinkPress?.('https://www.bible.com/versions/1')}
          >
            <Text>Learn More</Text>
          </Pressable>
        </View>
      )
    },
  }
})

jest.mock('../../dom/footnote-content', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { __esModule: true, default: () => <View testID="mock-footnote" /> }
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
  return { __esModule: true, BibleReaderSettingsSheet: () => <View testID="mock-settings-sheet" /> }
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

jest.mock('../../stores/reader-settings-store', () => ({
  useReaderSettingsStore: () => ({
    fontSize: 16,
    fontFamily: '"Inter", sans-serif',
    setFontSize: jest.fn(),
    setFontFamily: jest.fn(),
    setLineSpacing: jest.fn(),
    lineSpacing: 1.5,
  }),
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

describe('BibleReader external link handling', () => {
  beforeEach(async () => {
    latestDomProps = {}
    mockOpenBrowserAsync.mockClear()
    mmkvStorage.clearAll()
    useReaderLocationStore.setState(readerLocationStoreInitialState)
    await useReaderLocationStore.persist.rehydrate()
  })

  it('passes onExternalLinkPress across the bridge', () => {
    render(<BibleReader />, { wrapper })
    expect(typeof latestDomProps.onExternalLinkPress).toBe('function')
  })

  it('opens an outbound URL in the system browser', async () => {
    const { getByTestId } = render(<BibleReader />, { wrapper })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-external-link'))
    })

    expect(mockOpenBrowserAsync).toHaveBeenCalledWith(
      'https://www.bible.com/versions/1',
      expect.objectContaining({ dismissButtonStyle: 'close' }),
    )
  })
})
