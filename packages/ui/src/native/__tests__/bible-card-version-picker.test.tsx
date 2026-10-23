import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { BIBLE_CARD_VERSION_PERSIST_KEY } from '../../lib/constants'
import {
  bibleCardVersionStoreInitialState,
  useBibleCardVersionStore,
} from '../../stores/bible-card-version-store'
import { resetImpls, setImpl, stubImpl } from '../../test-utils/install-test-impls'
import {
  installBibleContentFetch,
  type BibleContentFetchStub,
} from '../../test-utils/stub-bible-content-fetch'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../theme'
import { BibleCard } from '../bible-card'
import * as bibleCardMetadata from '../bible-card-metadata'

const wrapper = youVersionProviderWrapper()

async function renderAndSettle(...args: Parameters<typeof render>) {
  const result = render(...args)
  await act(async () => {})
  await act(async () => {})
  return result
}

async function resetBibleCardVersionStore() {
  mmkvStorage.remove(BIBLE_CARD_VERSION_PERSIST_KEY)
  useBibleCardVersionStore.setState(bibleCardVersionStoreInitialState)
  await useBibleCardVersionStore.persist.rehydrate()
}

describe('BibleCard version picker integration', () => {
  let fetchStub: BibleContentFetchStub

  beforeEach(async () => {
    fetchStub = installBibleContentFetch()
    stubImpl('FootnoteContent', 'mock-footnote')
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

  it('opens the built-in version picker sheet on press when showVersionPicker is true and no consumer handler is provided', async () => {
    const { getByTestId, queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" showVersionPicker />,
      { wrapper },
    )

    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()

    await act(async () => {
      fireEvent.press(getByTestId('bible-card-version'))
    })

    expect(getByTestId('mock-version-picker-sheet')).toBeTruthy()
  })

  it('updates versionId when version picker selects a version', async () => {
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

    await waitFor(() => {
      expect(fetchStub.urls.some((url) => url.includes('/v1/bibles/59/passages/JHN.1'))).toBe(true)
    })
  })

  it('requests the seeded version when the store is empty', async () => {
    await renderAndSettle(<BibleCard reference="JHN.1.1" versionId={100} />, { wrapper })

    await waitFor(() => {
      expect(fetchStub.urls.some((url) => url.includes('/v1/bibles/100/passages/JHN.1'))).toBe(true)
    })
  })

  it('does not render version picker sheet when consumer provides onVersionPickerPress', async () => {
    const consumerHandler = jest.fn().mockResolvedValue(undefined)

    const { getByTestId, queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" showVersionPicker onVersionPickerPress={consumerHandler} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('bible-card-version'))
    })

    expect(consumerHandler).toHaveBeenCalledWith({ versionId: 3034, languageId: 'en' })
    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()
  })

  it('does not call consumer handler when chrome metadata has no language tag', async () => {
    jest.spyOn(bibleCardMetadata, 'getBibleCardMetadata').mockResolvedValue({
      reference: 'John 1:1',
      abbreviation: 'NIV',
      copyright: 'NIV copyright',
      languageTag: undefined,
    })
    const consumerHandler = jest.fn().mockResolvedValue(undefined)

    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" showVersionPicker onVersionPickerPress={consumerHandler} />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(getByTestId('bible-card-version'))
    })

    expect(consumerHandler).not.toHaveBeenCalled()
  })

  it('opens the built-in sheet when language tag is missing but no consumer handler is set', async () => {
    jest.spyOn(bibleCardMetadata, 'getBibleCardMetadata').mockResolvedValue({
      reference: 'John 1:1',
      abbreviation: 'NIV',
      copyright: 'NIV copyright',
      languageTag: undefined,
    })

    const { getByTestId, queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" showVersionPicker />,
      { wrapper },
    )

    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()

    await act(async () => {
      fireEvent.press(getByTestId('bible-card-version'))
    })

    expect(getByTestId('mock-version-picker-sheet')).toBeTruthy()
  })

  it('hides the built-in version picker on web when no consumer handler is provided', async () => {
    const originalOs = Platform.OS
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })

    try {
      const { queryByTestId } = await renderAndSettle(
        <BibleCard reference="JHN.1.1" showVersionPicker />,
        { wrapper },
      )

      expect(queryByTestId('bible-card-version')).toBeNull()
      expect(queryByTestId('mock-version-picker-sheet')).toBeNull()
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        enumerable: true,
        value: originalOs,
      })
    }
  })

  it('invokes consumer onVersionPickerPress on web', async () => {
    const originalOs = Platform.OS
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })
    const consumerHandler = jest.fn().mockResolvedValue(undefined)

    try {
      const { getByTestId } = await renderAndSettle(
        <BibleCard reference="JHN.1.1" showVersionPicker onVersionPickerPress={consumerHandler} />,
        { wrapper },
      )

      await act(async () => {
        fireEvent.press(getByTestId('bible-card-version'))
      })

      expect(consumerHandler).toHaveBeenCalledWith({ versionId: 3034, languageId: 'en' })
    } finally {
      Object.defineProperty(Platform, 'OS', {
        configurable: true,
        enumerable: true,
        value: originalOs,
      })
    }
  })

  it('hides the version picker by default (Web SDK parity) and does not mount the built-in sheet', async () => {
    const { queryByTestId } = await renderAndSettle(<BibleCard reference="JHN.1.1" />, { wrapper })

    expect(queryByTestId('bible-card-version')).toBeNull()
    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()
  })

  it('does not render version picker sheet when showVersionPicker is explicitly false', async () => {
    const { queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" showVersionPicker={false} />,
      {
        wrapper,
      },
    )

    expect(queryByTestId('mock-version-picker-sheet')).toBeNull()
    expect(queryByTestId('bible-card-version')).toBeNull()
  })

  it('resolves system theme to the provider theme', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" theme="system" />,
      {
        wrapper,
      },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      backgroundColor: getTokens('light').card,
    })
  })
})
