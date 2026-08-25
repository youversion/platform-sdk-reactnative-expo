import { act, fireEvent, render } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type { BibleVersionPickerPressData } from '@youversion/platform-react-ui'
import { Pressable, Text, View } from 'react-native'

import { BIBLE_CARD_VERSION_PERSIST_KEY } from '../../lib/constants'
import {
  bibleCardVersionStoreInitialState,
  useBibleCardVersionStore,
} from '../../stores/bible-card-version-store'
import { resetImpls, setImpl, stubImpl } from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleCard } from '../bible-card'

type LatestDomProps = {
  versionId?: number
  onVersionChange?: (versionId: number) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  showVersionPicker?: boolean
}

let latestDomProps: LatestDomProps = {}

function MockDOM(props: LatestDomProps) {
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
}

const wrapper = youVersionProviderWrapper()

async function resetBibleCardVersionStore() {
  mmkvStorage.remove(BIBLE_CARD_VERSION_PERSIST_KEY)
  useBibleCardVersionStore.setState(bibleCardVersionStoreInitialState)
  await useBibleCardVersionStore.persist.rehydrate()
}

describe('BibleCard version picker integration', () => {
  beforeEach(async () => {
    latestDomProps = {}
    stubImpl('FootnoteContent', 'mock-footnote')
    setImpl('BibleCardDom', MockDOM)
    setImpl('NativeSheet', () => <View testID="mock-footnote-sheet-stub" />)
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
    await resetBibleCardVersionStore()
  })

  afterEach(() => {
    resetImpls()
    jest.restoreAllMocks()
  })

  it('opens the built-in version picker sheet on press when showVersionPicker is true and no consumer handler is provided', async () => {
    const { getByTestId, queryByTestId } = render(
      <BibleCard reference="JHN.1.1" showVersionPicker />,
      { wrapper },
    )

    expect(getByTestId('show-picker').children).toContain('true')
    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    expect(getByTestId('mock-version-picker-sheet')).toBeTruthy()
  })

  it('updates versionId when version picker selects a version', async () => {
    const { getByTestId } = render(<BibleCard reference="JHN.1.1" showVersionPicker />, { wrapper })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    await act(async () => {
      fireEvent.press(getByTestId('select-version'))
    })

    expect(latestDomProps.versionId).toBe(59)
  })

  it('passes versionId seed to DOM component when store is empty', () => {
    render(<BibleCard reference="JHN.1.1" versionId={100} />, { wrapper })

    expect(latestDomProps.versionId).toBe(100)
  })

  it('does not render version picker sheet when consumer provides onVersionPickerPress', async () => {
    const consumerHandler = jest.fn().mockResolvedValue(undefined)

    const { getByTestId, queryByTestId } = render(
      <BibleCard reference="JHN.1.1" showVersionPicker onVersionPickerPress={consumerHandler} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    expect(consumerHandler).toHaveBeenCalledWith({ versionId: 3034, languageId: 'eng' })
    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()
  })

  it('hides the version picker by default (Web SDK parity) and does not mount the built-in sheet', async () => {
    const { getByTestId, queryByTestId } = render(<BibleCard reference="JHN.1.1" />, { wrapper })

    expect(latestDomProps.showVersionPicker).toBe(false)
    expect(getByTestId('show-picker').children).toContain('false')
    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()

    // Even if a press somehow reaches native, the sheet must not open.
    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()
  })

  it('does not render version picker sheet when showVersionPicker is explicitly false', () => {
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
