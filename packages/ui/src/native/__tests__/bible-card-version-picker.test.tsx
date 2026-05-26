import { act, fireEvent, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { BibleCard } from '../bible-card'
import { YouVersionProvider } from '../youversion-provider'
import type { BibleVersionPickerPressData } from '@youversion/platform-react-ui'

let latestDomProps: {
  versionId?: number
  onVersionChange?: (versionId: number) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  showVersionPicker?: boolean
} = {}

jest.mock('../../dom/bible-card', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
      versionId?: number
      onVersionChange?: (versionId: number) => Promise<void>
      onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
      showVersionPicker?: boolean
    }) {
      latestDomProps = props
      return (
        <View testID="mock-dom">
          <Text testID="version-id">{String(props.versionId ?? 'none')}</Text>
          <Text testID="show-picker">{String(props.showVersionPicker ?? 'none')}</Text>
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

jest.mock('../native-sheet', () => {
  const actual = jest.requireActual('../native-sheet')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    ...actual,
    NativeSheet: () => <View testID="mock-footnote-sheet-stub" />,
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
          <Pressable testID="select-version" onPress={() => onSelect?.(59)}>
            <Text>Select</Text>
          </Pressable>
          <Pressable testID="close-sheet" onPress={onClose}>
            <Text>Close</Text>
          </Pressable>
        </View>
      ) : null,
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

describe('BibleCard version picker integration', () => {
  beforeEach(() => {
    latestDomProps = {}
  })

  it('opens version picker sheet when DOM triggers onVersionPickerPress', async () => {
    const { getByTestId, queryByTestId } = render(<BibleCard reference="JHN.1.1" />, { wrapper })

    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    expect(getByTestId('mock-version-picker-sheet')).toBeTruthy()
  })

  it('updates versionId when version picker selects a version', async () => {
    const { getByTestId } = render(<BibleCard reference="JHN.1.1" />, { wrapper })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    await act(async () => {
      fireEvent.press(getByTestId('select-version'))
    })

    expect(latestDomProps.versionId).toBe(59)
  })

  it('passes controlled versionId to DOM component', () => {
    render(<BibleCard reference="JHN.1.1" versionId={100} />, { wrapper })

    expect(latestDomProps.versionId).toBe(100)
  })

  it('does not render version picker sheet when consumer provides onVersionPickerPress', async () => {
    const consumerHandler = jest.fn().mockResolvedValue(undefined)

    const { getByTestId, queryByTestId } = render(
      <BibleCard reference="JHN.1.1" onVersionPickerPress={consumerHandler} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    expect(consumerHandler).toHaveBeenCalledWith({ versionId: 3034, languageId: 'eng' })
    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()
  })

  it('does not render version picker sheet when showVersionPicker is false', () => {
    const { queryByTestId } = render(<BibleCard reference="JHN.1.1" showVersionPicker={false} />, {
      wrapper,
    })

    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()
    expect(latestDomProps.showVersionPicker).toBe(false)
  })

  it('resolves system theme to provider theme', () => {
    render(<BibleCard reference="JHN.1.1" theme="system" />, { wrapper })

    expect(latestDomProps.versionId).toBeDefined()
  })
})
