import { act, fireEvent, render } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type {
  BibleChapterPickerPressData,
  BibleVersionPickerPressData,
} from '@youversion/platform-react-ui'
import { Pressable, Text, View } from 'react-native'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import {
  installBibleReaderTestImpls,
  resetImpls,
  setImpl,
} from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'

type LatestDomProps = {
  versionId?: number
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onChapterPickerPress?: (data: BibleChapterPickerPressData) => Promise<void>
}

let latestDomProps: LatestDomProps = {}

function MockDOM(props: LatestDomProps) {
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
}

const wrapper = youVersionProviderWrapper()

describe('BibleReader version picker integration', () => {
  beforeEach(async () => {
    latestDomProps = {}
    installBibleReaderTestImpls()
    setImpl('BibleReaderDom', MockDOM)
    setImpl(
      'BibleVersionPickerSheet',
      ({
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
    )
    mmkvStorage.clearAll()
    useReaderLocationStore.setState(readerLocationStoreInitialState)
    await useReaderLocationStore.persist.rehydrate()
  })

  afterEach(() => {
    resetImpls()
    jest.restoreAllMocks()
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
