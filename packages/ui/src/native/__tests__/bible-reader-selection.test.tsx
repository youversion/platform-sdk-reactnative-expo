import { act, fireEvent, render, screen } from '@testing-library/react-native'
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

const SHARE_DATA: BibleReaderShareData = {
  text: '“In the beginning was the Word...”\n\nJohn 1:1-2 NIV',
  reference: 'John 1:1-2 NIV',
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

/** Which selection payload the mocked DOM component emits on the next press. */
let mockNextSelection: BibleReaderVerseSelection = SELECTION

let latestDomProps: {
  onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
  verseActions?: 'popover' | 'none'
} = {}

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
      onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
    }) {
      latestDomProps = props
      return (
        <View testID="mock-dom">
          <Pressable
            testID="trigger-verse-select"
            onPress={() => void props.onVerseSelect?.(mockNextSelection)}
          >
            <Text>Select</Text>
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

/**
 * Select verses in the WebView, then press Copy or Share **on the native
 * sheet**. Since Phase 9 that is the only way to reach these handlers: the Web
 * SDK's popover is suppressed, so no `onCopy` / `onShare` Native Action crosses
 * the bridge at all. The contract below is unchanged — only the caller moved.
 */
async function pressVerseAction(testID: 'bible-verse-action-copy' | 'bible-verse-action-share') {
  await act(async () => {
    fireEvent.press(screen.getByTestId('trigger-verse-select'))
  })
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID))
  })
}

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

    render(
      <BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onVerseSelect={onVerseSelect} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-verse-select'))
    })

    expect(onVerseSelect).toHaveBeenCalledTimes(1)
    expect(onVerseSelect).toHaveBeenCalledWith(SELECTION)
  })

  it('forwards the clear, which arrives as an empty verses array', async () => {
    const onVerseSelect = jest.fn()
    mockNextSelection = CLEARED_SELECTION

    render(
      <BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onVerseSelect={onVerseSelect} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-verse-select'))
    })

    expect(onVerseSelect).toHaveBeenCalledWith(CLEARED_SELECTION)
  })
})

describe('BibleReader copy', () => {
  it('writes the selection text to the clipboard when the consumer has no handler', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await pressVerseAction('bible-verse-action-copy')

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1)
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(SHARE_DATA.text)
  })

  it('lets a consumer handler win over the SDK fallback', async () => {
    const onCopy = jest.fn().mockResolvedValue(undefined)

    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onCopy={onCopy} />, {
      wrapper,
    })

    await pressVerseAction('bible-verse-action-copy')

    expect(onCopy).toHaveBeenCalledWith(SHARE_DATA)
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
  })

  it('does not throw when a consumer handler rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const onCopy = jest.fn().mockRejectedValue(new Error('nope'))

    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onCopy={onCopy} />, {
      wrapper,
    })

    await pressVerseAction('bible-verse-action-copy')

    expect(onCopy).toHaveBeenCalledTimes(1)
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
  })

  it('does not throw when the clipboard write rejects', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    ;(Clipboard.setStringAsync as jest.Mock).mockRejectedValueOnce(new Error('no pasteboard'))

    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await pressVerseAction('bible-verse-action-copy')

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1)
  })
})

describe('BibleReader share', () => {
  it('opens the native share sheet when the consumer has no handler', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await pressVerseAction('bible-verse-action-share')

    expect(Share.share).toHaveBeenCalledWith({ message: SHARE_DATA.text })
  })

  it('lets a consumer handler win over the SDK fallback', async () => {
    const onShare = jest.fn().mockResolvedValue(undefined)

    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} onShare={onShare} />, {
      wrapper,
    })

    await pressVerseAction('bible-verse-action-share')

    expect(onShare).toHaveBeenCalledWith(SHARE_DATA)
    expect(Share.share).not.toHaveBeenCalled()
  })

  it('does not throw when the share sheet rejects — a dismiss is not an error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('dismissed'))

    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    await pressVerseAction('bible-verse-action-share')

    expect(Share.share).toHaveBeenCalledTimes(1)
  })
})

describe('BibleReader verse actions on web', () => {
  it('keeps the Web SDK popover, since NativeSheet renders nothing there', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })

    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })

    expect(latestDomProps.verseActions).toBe('popover')

    // No native sheet, so no native Copy/Share — the Web SDK's own
    // `navigator.clipboard` / Web Share defaults stay correct on web.
    await act(async () => {
      fireEvent.press(screen.getByTestId('trigger-verse-select'))
    })
    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
  })
})
