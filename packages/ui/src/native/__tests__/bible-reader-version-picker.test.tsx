import { act, fireEvent, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'
import type {
  BibleChapterPickerPressData,
  BibleVersionPickerPressData,
} from '@youversion/platform-react-ui'

let latestDomProps: {
  versionId?: number
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onChapterPickerPress?: (data: BibleChapterPickerPressData) => Promise<void>
} = {}

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
      versionId?: number
      onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
      onChapterPickerPress?: (data: BibleChapterPickerPressData) => Promise<void>
    }) {
      latestDomProps = props
      return (
        <View testID="mock-dom">
          <Text testID="version-id">{String(props.versionId ?? 'none')}</Text>
          <Pressable
            testID="trigger-version-picker"
            onPress={() => {
              if (props.onVersionPickerPress) {
                props.onVersionPickerPress({ versionId: 3034, languageId: 'eng' })
              }
            }}
          >
            <Text>VersionPicker</Text>
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
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    BibleVersionPickerSheet: ({
      isOpen,
      onClose,
      onSelect,
      versionId,
    }: {
      isOpen: boolean
      onClose: () => void
      onSelect?: (versionId: number) => Promise<void>
      versionId?: number
    }) =>
      isOpen ? (
        <View testID="mock-version-picker-sheet">
          <Text testID="sheet-version-id">{String(versionId ?? 'none')}</Text>
          <Pressable
            testID="select-version"
            onPress={() => onSelect?.(59)}
          >
            <Text>Select</Text>
          </Pressable>
          <Pressable testID="close-sheet" onPress={onClose}>
            <Text>Close</Text>
          </Pressable>
        </View>
      ) : null,
  }
})

jest.mock('../native-sheet', () => {
  const actual = jest.requireActual('../native-sheet')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    ...actual,
    NativeSheet: ({
      isOpen,
      children,
    }: {
      isOpen: boolean
      children: ReactNode
    }) => (isOpen ? <View testID="sheet">{children}</View> : null),
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
    setFontSize: jest.fn(),
    setFontFamily: jest.fn(),
  }),
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

describe('BibleReader version picker integration', () => {
  beforeEach(() => {
    latestDomProps = {}
  })

  it('opens version picker sheet when DOM triggers onVersionPickerPress', async () => {
    const { getByTestId, queryByTestId } = render(<BibleReader />, { wrapper })

    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    expect(getByTestId('mock-version-picker-sheet')).toBeTruthy()
  })

  it('updates versionId when version picker selects a version', async () => {
    const { getByTestId } = render(<BibleReader />, { wrapper })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    await act(async () => {
      fireEvent.press(getByTestId('select-version'))
    })

    expect(latestDomProps.versionId).toBe(59)
  })

  it('does not render version picker sheet when consumer provides onVersionPickerPress', async () => {
    const consumerHandler = jest.fn().mockResolvedValue(undefined)

    const { getByTestId, queryByTestId } = render(
      <BibleReader onVersionPickerPress={consumerHandler} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    expect(consumerHandler).toHaveBeenCalledWith({ versionId: 3034, languageId: 'eng' })
    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()
  })
})
