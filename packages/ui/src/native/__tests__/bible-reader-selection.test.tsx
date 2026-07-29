import { act, fireEvent, render } from '@testing-library/react-native'
import type { BibleReaderShareData, BibleReaderVerseSelection } from '@youversion/platform-react-ui'
import * as Clipboard from 'expo-clipboard'
import type { ReactNode } from 'react'
import { Platform, Share } from 'react-native'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { resetAuthMock } from '../../test-utils/auth-mock'
import { resetHighlightsMock } from '../../test-utils/highlights-mock'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
}))

const VERSION_ID = 111

const SELECTION: BibleReaderVerseSelection = {
  versionId: VERSION_ID,
  book: 'JHN',
  chapter: '1',
  verses: [1, 2],
  passageIds: ['JHN.1.1', 'JHN.1.2'],
}

const CLEARED_SELECTION: BibleReaderVerseSelection = {
  ...SELECTION,
  verses: [],
  passageIds: [],
}

const SHARE_DATA: BibleReaderShareData = {
  text: '“In the beginning was the Word...”\n\nJohn 1:1-2 NIV',
  reference: 'John 1:1-2 NIV',
  verseText: '“In the beginning was the Word...”',
  verses: [1, 2],
  book: 'JHN',
  chapter: '1',
  versionId: VERSION_ID,
}

/** Which selection payload the mocked DOM component emits on the next press. */
let mockNextSelection: BibleReaderVerseSelection = SELECTION

let latestDomProps: {
  onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
  onCopy?: (data: BibleReaderShareData) => Promise<void>
  onShare?: (data: BibleReaderShareData) => Promise<void>
} = {}

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
      onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
      onCopy?: (data: BibleReaderShareData) => Promise<void>
      onShare?: (data: BibleReaderShareData) => Promise<void>
    }) {
      latestDomProps = props
      return (
        <View testID="mock-dom">
          <Text testID="has-copy-handler">{props.onCopy ? 'yes' : 'no'}</Text>
          <Text testID="has-share-handler">{props.onShare ? 'yes' : 'no'}</Text>
          <Pressable
            testID="trigger-verse-select"
            onPress={() => void props.onVerseSelect?.(mockNextSelection)}
          >
            <Text>Select</Text>
          </Pressable>
          <Pressable testID="trigger-copy" onPress={() => void props.onCopy?.(SHARE_DATA)}>
            <Text>Copy</Text>
          </Pressable>
          <Pressable testID="trigger-share" onPress={() => void props.onShare?.(SHARE_DATA)}>
            <Text>Share</Text>
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

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

const originalOs = Platform.OS

beforeEach(() => {
  latestDomProps = {}
  mockNextSelection = SELECTION
  resetHighlightsMock()
  resetAuthMock()
  useReaderLocationStore.setState(readerLocationStoreInitialState)
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
})

afterEach(() => {
  jest.restoreAllMocks()
  ;(Clipboard.setStringAsync as jest.Mock).mockClear()
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    enumerable: true,
    value: originalOs,
  })
})

describe('BibleReader verse selection', () => {
  it('forwards the selection payload to the consumer', async () => {
    const onVerseSelect = jest.fn()

    const { getByTestId } = render(
      <BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onVerseSelect={onVerseSelect} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('trigger-verse-select'))
    })

    expect(onVerseSelect).toHaveBeenCalledTimes(1)
    expect(onVerseSelect).toHaveBeenCalledWith(SELECTION)
  })

  it('forwards the clear, which arrives as an empty verses array', async () => {
    const onVerseSelect = jest.fn()
    mockNextSelection = CLEARED_SELECTION

    const { getByTestId } = render(
      <BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onVerseSelect={onVerseSelect} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('trigger-verse-select'))
    })

    expect(onVerseSelect).toHaveBeenCalledWith(CLEARED_SELECTION)
  })

  it('leaves onVerseSelect undefined on the bridge when the consumer does not pass one', () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.onVerseSelect).toBeUndefined()
  })
})

describe('BibleReader copy', () => {
  it('writes the selection text to the clipboard when the consumer has no handler', async () => {
    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-copy'))
    })

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1)
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(SHARE_DATA.text)
  })

  it('lets a consumer handler win over the SDK fallback', async () => {
    const onCopy = jest.fn().mockResolvedValue(undefined)

    const { getByTestId } = render(
      <BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onCopy={onCopy} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('trigger-copy'))
    })

    expect(onCopy).toHaveBeenCalledWith(SHARE_DATA)
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
  })

  it('does not throw when a consumer handler rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const onCopy = jest.fn().mockRejectedValue(new Error('nope'))

    const { getByTestId } = render(
      <BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onCopy={onCopy} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('trigger-copy'))
    })

    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
  })

  it('does not throw when the clipboard write rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(new Error('no pasteboard'))

    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-copy'))
    })

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1)
  })

  it('leaves the Web SDK its own clipboard default on web', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })

    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    expect(getByTestId('has-copy-handler').children).toContain('no')
    await act(async () => {
      fireEvent.press(getByTestId('trigger-copy'))
    })
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
  })
})

describe('BibleReader share', () => {
  it('opens the native share sheet when the consumer has no handler', async () => {
    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-share'))
    })

    expect(Share.share).toHaveBeenCalledWith({ message: SHARE_DATA.text })
  })

  it('lets a consumer handler win over the SDK fallback', async () => {
    const onShare = jest.fn().mockResolvedValue(undefined)

    const { getByTestId } = render(
      <BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onShare={onShare} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('trigger-share'))
    })

    expect(onShare).toHaveBeenCalledWith(SHARE_DATA)
    expect(Share.share).not.toHaveBeenCalled()
  })

  it('does not throw when the share sheet rejects — a dismiss is not an error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('dismissed'))

    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-share'))
    })

    expect(Share.share).toHaveBeenCalledTimes(1)
  })

  it('leaves the Web SDK its own Web Share default on web', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })

    const { getByTestId } = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, {
      wrapper,
    })

    expect(getByTestId('has-share-handler').children).toContain('no')
    await act(async () => {
      fireEvent.press(getByTestId('trigger-share'))
    })
    expect(Share.share).not.toHaveBeenCalled()
  })
})
