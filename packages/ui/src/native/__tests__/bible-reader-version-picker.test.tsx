import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type {
  BibleChapterPickerPressData,
  BibleVersionPickerPressData,
} from '../../lib/bible-ui-types'
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

async function settleToolbar() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setImmediate(resolve)
    })
  })
  await waitFor(() => {
    expect(screen.queryByTestId('reader-toolbar-version-loading')).toBeNull()
  })
}

async function pressVersion() {
  await settleToolbar()
  await act(async () => {
    fireEvent.press(screen.getByTestId('reader-toolbar-version'))
  })
}

describe('BibleReader version picker integration', () => {
  beforeEach(async () => {
    latestDomProps = {}
    installBibleReaderTestImpls()
    setImpl('BibleReaderNative', MockDOM)
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

  it('opens the version picker sheet from the toolbar', async () => {
    render(<BibleReader />, { wrapper })

    expect(screen.queryByTestId('mock-version-picker-sheet')).toBeNull()

    await pressVersion()

    expect(screen.getByTestId('mock-version-picker-sheet')).toBeTruthy()
  })

  it('updates versionId when version picker selects a version', async () => {
    render(<BibleReader />, { wrapper })

    await pressVersion()

    await act(async () => {
      fireEvent.press(screen.getByTestId('select-version'))
    })

    expect(latestDomProps.versionId).toBe(59)
  })

  it('does not render version picker sheet when consumer provides onVersionPickerPress', async () => {
    const consumerHandler = jest.fn().mockResolvedValue(undefined)

    render(<BibleReader onVersionPickerPress={consumerHandler} />, { wrapper })

    await pressVersion()

    expect(consumerHandler).toHaveBeenCalledWith(
      expect.objectContaining({ versionId: 3034, languageId: expect.any(String) }),
    )
    expect(screen.queryByTestId('mock-version-picker-sheet')).toBeNull()
  })
})
