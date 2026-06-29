import { act, fireEvent, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { BIBLE_CARD_VERSION_PERSIST_KEY } from '../../lib/constants'
import {
  bibleCardVersionStoreInitialState,
  useBibleCardVersionStore,
} from '../../stores/bible-card-version-store'
import { BibleCard } from '../bible-card'
import { YouVersionProvider } from '../youversion-provider'
import type { BibleVersionPickerPressData } from '@youversion/platform-react-ui'

let latestDomProps: {
  versionId?: number
  onVersionChange?: (versionId: number) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
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
    }) {
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
  }
})

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

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
    await resetBibleCardVersionStore()
  })

  it('hydrates uncontrolled state from MMKV on mount', async () => {
    await seedBibleCardVersion(59)

    render(<BibleCard reference="JHN.1.1" />, { wrapper })

    expect(latestDomProps.versionId).toBe(59)
  })

  it('persists picker selection to MMKV', async () => {
    const { getByTestId } = render(<BibleCard reference="JHN.1.1" />, { wrapper })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-version-picker'))
    })

    await act(async () => {
      fireEvent.press(getByTestId('select-version'))
    })

    const raw = mmkvStorage.getString(BIBLE_CARD_VERSION_PERSIST_KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as { state: { versionId?: number } }
    expect(parsed.state.versionId).toBe(59)
  })

  it('does not persist when versionId and onVersionChange are both provided', async () => {
    await seedBibleCardVersion(3034)
    const onVersionChange = jest.fn()

    const { getByTestId } = render(
      <BibleCard reference="JHN.1.1" versionId={3034} onVersionChange={onVersionChange} />,
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
    const parsed = JSON.parse(raw!) as { state: { versionId?: number } }
    expect(parsed.state.versionId).toBe(3034)
  })

  it('uses stored version over versionId seed prop when uncontrolled', async () => {
    await seedBibleCardVersion(59)

    render(<BibleCard reference="JHN.1.1" versionId={3034} />, { wrapper })

    expect(latestDomProps.versionId).toBe(59)
  })
})
