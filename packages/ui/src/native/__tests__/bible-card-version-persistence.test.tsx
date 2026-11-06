import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import { BIBLE_CARD_VERSION_PERSIST_KEY } from '../../lib/constants'
import {
  bibleCardVersionStoreInitialState,
  useBibleCardVersionStore,
} from '../../stores/bible-card-version-store'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { resetImpls, setImpl, stubImpl } from '../../test-utils/install-test-impls'
import {
  installBibleContentFetch,
  type BibleContentFetchStub,
} from '../../test-utils/stub-bible-content-fetch'
import en from '../../i18n/locales/en.json'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleCard } from '../bible-card'
import * as bibleCardMetadata from '../bible-card-metadata'
import { YouVersionProvider } from '../youversion-provider'

type PersistedCardVersion = {
  state: { versionId?: number }
}

const wrapper = youVersionProviderWrapper()

async function renderAndSettle(...args: Parameters<typeof render>) {
  const result = render(...args)
  await act(async () => {})
  await act(async () => {})
  return result
}

const refuseFilterWrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider
    appKey="test-key"
    theme="light"
    hookOverrides={defaultHookOverrides}
    permittedVersionIds={[]}
  >
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
  let fetchStub: BibleContentFetchStub

  beforeEach(async () => {
    fetchStub = installBibleContentFetch()
    stubImpl('FootnoteContent', 'mock-footnote')
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
    jest.spyOn(bibleCardMetadata, 'getBibleCardMetadata').mockResolvedValue({
      reference: 'John 1:1',
      abbreviation: 'NIV',
      copyright: 'NIV copyright',
      languageTag: 'en',
    })
    await resetBibleCardVersionStore()
  })

  afterEach(() => {
    fetchStub.restore()
    resetImpls()
    jest.restoreAllMocks()
  })

  it('hydrates uncontrolled state from MMKV on mount', async () => {
    await seedBibleCardVersion(59)

    const { getByText } = await renderAndSettle(<BibleCard reference="JHN.1.1" />, { wrapper })

    await waitFor(() => {
      expect(getByText('In the beginning')).toBeTruthy()
    })
    expect(fetchStub.urls.some((url) => url.includes('/v1/bibles/59/passages/JHN.1'))).toBe(true)
  })

  it('persists picker selection to MMKV', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" showVersionPicker />,
      {
        wrapper,
      },
    )

    await act(async () => {
      fireEvent.press(getByTestId('bible-card-version'))
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

    const { getByTestId } = await renderAndSettle(
      <BibleCard
        reference="JHN.1.1"
        versionId={3034}
        onVersionChange={onVersionChange}
        showVersionPicker
      />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('bible-card-version'))
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

    await renderAndSettle(<BibleCard reference="JHN.1.1" versionId={3034} />, { wrapper })

    await waitFor(() => {
      expect(fetchStub.urls.some((url) => url.includes('/v1/bibles/59/passages/JHN.1'))).toBe(true)
    })
    expect(fetchStub.urls.some((url) => url.includes('/v1/bibles/3034/passages/'))).toBe(false)
  })

  it('keeps a stored version when filters refuse it and does not load the verse', async () => {
    await seedBibleCardVersion(59)

    const { getByText, queryByText } = await renderAndSettle(<BibleCard reference="JHN.1.1" />, {
      wrapper: refuseFilterWrapper,
    })

    expect(getByText(en.passageUnavailable)).toBeTruthy()
    expect(queryByText('In the beginning')).toBeNull()
    expect(fetchStub.urls.some((url) => url.includes('/passages/'))).toBe(false)

    const raw = mmkvStorage.getString(BIBLE_CARD_VERSION_PERSIST_KEY)
    expect(raw).toBeTruthy()
    if (raw === undefined) {
      throw new Error('expected persisted bible card version')
    }
    // SAFETY: zustand persist writes `{ state, version }`; this test seeded versionId.
    const parsed = JSON.parse(raw) as { state: { versionId?: number } }
    expect(parsed.state.versionId).toBe(59)
  })

  it('does not load a host version the filters refuse and does not rewrite it', async () => {
    const { getByText, queryByText } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={59} />,
      { wrapper: refuseFilterWrapper },
    )

    expect(getByText(en.passageUnavailable)).toBeTruthy()
    expect(queryByText('In the beginning')).toBeNull()
    expect(fetchStub.urls.some((url) => url.includes('/passages/'))).toBe(false)
  })
})
