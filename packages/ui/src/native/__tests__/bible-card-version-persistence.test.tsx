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
}

type PersistedCardVersion = {
  state: { versionId?: number }
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
          props.onVersionPickerPress?.({ versionId: 3034, languageId: 'eng' })
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

async function seedBibleCardVersion(versionId: number) {
  mmkvStorage.set(
    BIBLE_CARD_VERSION_PERSIST_KEY,
    JSON.stringify({
      state: { versionId },
      version: 0,
    }),
  )
  await useBibleCardVersionStore.persist.rehydrate()
}

describe('BibleCard version persistence', () => {
  beforeEach(async () => {
    latestDomProps = {}
    stubImpl('FootnoteContent', 'mock-footnote')
    setImpl('BibleCardDom', MockDOM)
    setImpl('NativeSheet', () => <View testID="mock-footnote-sheet-stub" />)
    setImpl(
      'BibleVersionPickerSheet',
      ({
        isOpen,
        onSelect,
      }: {
        isOpen: boolean
        onSelect?: (versionId: number) => Promise<void>
      }) =>
        isOpen ? (
          <View testID="mock-version-picker-sheet">
            <Pressable testID="select-version" onPress={() => onSelect?.(59)}>
              <Text>Select</Text>
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

  it('hydrates uncontrolled state from MMKV on mount', async () => {
    await seedBibleCardVersion(59)

    render(<BibleCard reference="JHN.1.1" />, { wrapper })

    expect(latestDomProps.versionId).toBe(59)
  })

  it('persists picker selection to MMKV', async () => {
    const { getByTestId } = render(<BibleCard reference="JHN.1.1" showVersionPicker />, {
      wrapper,
    })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    await act(async () => {
      fireEvent.press(getByTestId('select-version'))
    })

    const raw = mmkvStorage.getString(BIBLE_CARD_VERSION_PERSIST_KEY)
    expect(raw).toBeTruthy()
    const parsed: PersistedCardVersion = JSON.parse(raw!)
    expect(parsed.state.versionId).toBe(59)
  })

  it('does not persist when versionId and onVersionChange are both provided', async () => {
    await seedBibleCardVersion(3034)
    const onVersionChange = jest.fn()

    const { getByTestId } = render(
      <BibleCard
        reference="JHN.1.1"
        versionId={3034}
        onVersionChange={onVersionChange}
        showVersionPicker
      />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    await act(async () => {
      fireEvent.press(getByTestId('select-version'))
    })

    // Zustand persist may write the store key on hydrate; assert the picker did not overwrite MMKV.
    const raw = mmkvStorage.getString(BIBLE_CARD_VERSION_PERSIST_KEY)
    expect(raw).toBeTruthy()
    const parsed: PersistedCardVersion = JSON.parse(raw!)
    expect(parsed.state.versionId).toBe(3034)
  })

  it('uses stored version over versionId seed prop when uncontrolled', async () => {
    await seedBibleCardVersion(59)

    render(<BibleCard reference="JHN.1.1" versionId={3034} />, { wrapper })

    expect(latestDomProps.versionId).toBe(59)
  })
})
