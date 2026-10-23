import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type { FootnoteData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import type { ReactTestInstance } from 'react-test-renderer'
import * as ReactNative from 'react-native'
import { Platform, Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native'

import en from '../../i18n/locales/en.json'
import es from '../../i18n/locales/es.json'
import { BIBLE_CARD_VERSION_PERSIST_KEY } from '../../lib/constants'
import {
  bibleCardVersionStoreInitialState,
  useBibleCardVersionStore,
} from '../../stores/bible-card-version-store'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import {
  installBibleContentFetch,
  type BibleContentFetchStub,
} from '../../test-utils/stub-bible-content-fetch'
import { stubDeviceLocale } from '../../test-utils/stub-device-locale'
import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../theme'
import { BibleCard } from '../bible-card'
import * as bibleCardMetadata from '../bible-card-metadata'
import { YouVersionProvider } from '../youversion-provider'

const black = require('../../../assets/bible-app-wordmark-black-text.png')
const white = require('../../../assets/bible-app-wordmark-white-text.png')

const sampleMetadata = {
  reference: 'John 3:16',
  abbreviation: 'NIV',
  copyright: 'NIV copyright',
  languageTag: 'en',
}

async function renderAndSettle(...args: Parameters<typeof render>) {
  const result = render(...args)
  await act(async () => {})
  await act(async () => {})
  return result
}

function fontSizeOf(node: ReactTestInstance): number | undefined {
  let current: ReactTestInstance | null = node
  while (current !== null) {
    const size = flattenedTextStyle(current).fontSize
    if (size !== undefined) {
      return size
    }
    current = current.parent
  }
  return undefined
}

function fontFamilyOf(node: ReactTestInstance): string | undefined {
  let current: ReactTestInstance | null = node
  while (current !== null) {
    const family = flattenedTextStyle(current).fontFamily
    if (family !== undefined) {
      return family
    }
    current = current.parent
  }
  return undefined
}

function flattenedTextStyle(node: ReactTestInstance): TextStyle {
  // SAFETY: StyleSheet.flatten returns the merged RN style object for this node.
  return (StyleSheet.flatten(node.props.style) ?? {}) as TextStyle
}

async function pressFootnote(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByLabelText(en.footnoteAriaLabel)).toBeTruthy()
  })
  fireEvent.press(screen.getByLabelText(en.footnoteAriaLabel))
}

function MockFootnoteContent(props: {
  data: FootnoteData
  theme?: string
  scriptureDirection?: 'ltr' | 'rtl'
}) {
  return (
    <View testID="mock-footnote-content">
      <Text testID="mock-footnote-verse">{props.data.verseNum}</Text>
      <Text testID="mock-footnote-theme">{props.theme ?? ''}</Text>
      <Text testID="mock-footnote-direction">{props.scriptureDirection ?? ''}</Text>
    </View>
  )
}

function snapshotHasReaderWidthToken(snapshot: string): boolean {
  return snapshot.includes('--yv-reader-max-width') || snapshot.includes('65ch')
}

describe('BibleCard', () => {
  const originalOs = Platform.OS
  let fetchStub: BibleContentFetchStub

  beforeEach(async () => {
    fetchStub = installBibleContentFetch()
    stubDeviceLocale('xx-XX', 'xx')
    setImpl('FootnoteContent', MockFootnoteContent)
    setImpl('BibleVersionPickerSheet', () => <View testID="mock-version-picker-sheet-stub" />)
    setImpl(
      'NativeSheet',
      ({
        isOpen,
        onClose,
        children,
      }: {
        isOpen: boolean
        onClose: () => void
        children: ReactNode
      }) =>
        isOpen ? (
          <View testID="footnote-sheet">
            <Pressable testID="footnote-sheet-close" onPress={onClose}>
              <Text>Close</Text>
            </Pressable>
            {children}
          </View>
        ) : null,
    )
    jest.spyOn(bibleCardMetadata, 'getBibleCardMetadata').mockResolvedValue(sampleMetadata)
    mmkvStorage.remove(BIBLE_CARD_VERSION_PERSIST_KEY)
    useBibleCardVersionStore.setState(bibleCardVersionStoreInitialState)
    await useBibleCardVersionStore.persist.rehydrate()
  })

  afterEach(() => {
    fetchStub.restore()
    resetImpls()
    jest.restoreAllMocks()
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: originalOs,
    })
  })

  it('renders native chrome around the verse', async () => {
    const { getByTestId, getByText, queryByTestId, queryByText } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('bible-card')).toBeTruthy()
    expect(getByText('John 3:16 NIV')).toBeTruthy()
    expect(getByText('NIV copyright')).toBeTruthy()
    const { source, accessibilityLabel } = getByTestId('bible-card-attribution').props
    expect(source).toEqual(black)
    expect(accessibilityLabel).toBe('Bible App')
    expect(queryByText('Bible App')).toBeNull()
    await waitFor(() => {
      expect(getByText('For God so loved')).toBeTruthy()
    })
    expect(getByText('16')).toBeTruthy()
    expect(queryByTestId('bible-card-version')).toBeNull()
  })

  it('keeps the Bible App name when the catalog translates it', async () => {
    const { getByTestId, queryByText } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: wrapper('light', 'es') },
    )

    expect(getByTestId('bible-card-attribution').props.accessibilityLabel).toBe('Bible App')
    expect(queryByText('Biblia App')).toBeNull()
    expect(queryByText('Bible App')).toBeNull()
  })

  it('exposes the passage reference as an accessible heading', async () => {
    const { getByText } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(getByText('John 3:16 NIV').props.accessibilityRole).toBe('header')
  })

  it('honors the web background prop when theme is omitted', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} background="dark" />,
      { wrapper: wrapper('light') },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      backgroundColor: getTokens('dark').card,
    })
    expect(getByTestId('bible-card-attribution').props.source).toEqual(white)
  })

  it('clears chrome metadata synchronously when reference changes', async () => {
    const TestWrapper = wrapper()
    const { getByText, queryByText, rerender } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: TestWrapper },
    )

    expect(getByText('John 3:16 NIV')).toBeTruthy()

    let resolveNewMetadata: (value: typeof sampleMetadata) => void = () => {}
    jest
      .spyOn(bibleCardMetadata, 'getBibleCardMetadata')
      .mockImplementation((_fetch, _versionId, passageId) => {
        if (passageId === 'GEN.1.1') {
          return new Promise((resolve) => {
            resolveNewMetadata = resolve
          })
        }
        return Promise.resolve(sampleMetadata)
      })

    rerender(
      <TestWrapper>
        <BibleCard reference="GEN.1.1" versionId={3034} />
      </TestWrapper>,
    )

    expect(queryByText('John 3:16 NIV')).toBeNull()

    await act(async () => {
      resolveNewMetadata({ ...sampleMetadata, reference: 'Genesis 1:1' })
    })

    expect(getByText('Genesis 1:1 NIV')).toBeTruthy()
  })

  it('paints the card surface from the light tokens', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: wrapper('light') },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      backgroundColor: getTokens('light').card,
    })
  })

  it('paints the card surface from the dark tokens', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: wrapper('dark') },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      backgroundColor: getTokens('dark').card,
    })
  })

  it('requests the chapter through the Bible content client', async () => {
    const { getByText } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: wrapper() },
    )

    await waitFor(() => {
      expect(getByText('For God so loved')).toBeTruthy()
    })
    expect(getByText('16')).toBeTruthy()
    expect(
      fetchStub.urls.some((url) =>
        url.startsWith('https://api.youversion.com/v1/bibles/3034/passages/JHN.3?'),
      ),
    ).toBe(true)
    expect(fetchStub.appKeys).toContain('test-key')
  })

  function versionFilterWrapper(lists: {
    permittedVersionIds?: number[]
    excludedVersionIds?: number[]
    permittedLanguageTags?: string[]
  }) {
    function FilterWrapper({ children }: { children: ReactNode }) {
      return (
        <YouVersionProvider
          appKey="test-key"
          theme="light"
          hookOverrides={defaultHookOverrides}
          {...lists}
        >
          {children}
        </YouVersionProvider>
      )
    }
    return FilterWrapper
  }

  it('does not request a verse the provider filters refuse', async () => {
    const { getByText, queryByText } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      {
        wrapper: versionFilterWrapper({
          permittedVersionIds: [111],
          excludedVersionIds: [3034],
          permittedLanguageTags: ['en'],
        }),
      },
    )

    expect(getByText(en.passageUnavailable)).toBeTruthy()
    expect(queryByText('For God so loved')).toBeNull()
    expect(fetchStub.urls.some((url) => url.includes('/passages/'))).toBe(false)
  })

  it('passes provider version filters into chrome metadata lookups', async () => {
    const getMetadata = jest
      .spyOn(bibleCardMetadata, 'getBibleCardMetadata')
      .mockResolvedValue(sampleMetadata)

    await renderAndSettle(<BibleCard reference="JHN.3.16" versionId={3034} />, {
      wrapper: versionFilterWrapper({
        permittedVersionIds: [111],
        excludedVersionIds: [3034],
        permittedLanguageTags: ['en'],
      }),
    })

    expect(getMetadata).toHaveBeenCalledWith(expect.any(Function), 3034, 'JHN.3.16', {
      permittedVersionIds: [111],
      excludedVersionIds: [3034],
      permittedLanguageTags: ['en'],
    })
  })

  it('hides chrome metadata when the version is refused by provider filters', async () => {
    jest.spyOn(bibleCardMetadata, 'getBibleCardMetadata').mockResolvedValue(null)

    const { getByText, queryByText } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      {
        wrapper: versionFilterWrapper({
          permittedVersionIds: [],
        }),
      },
    )

    expect(queryByText('John 3:16 NIV')).toBeNull()
    expect(queryByText('NIV copyright')).toBeNull()
    expect(queryByText('For God so loved')).toBeNull()
    expect(getByText(en.passageUnavailable)).toBeTruthy()
  })

  it('clears chrome metadata synchronously when provider filters tighten', async () => {
    const OpenWrapper = versionFilterWrapper({})
    const { getByText, queryByText, rerender } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: OpenWrapper },
    )

    expect(getByText('John 3:16 NIV')).toBeTruthy()

    let resolveRefused: (value: null) => void = () => {}
    jest.spyOn(bibleCardMetadata, 'getBibleCardMetadata').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefused = resolve
        }),
    )

    const TightWrapper = versionFilterWrapper({ permittedVersionIds: [] })
    rerender(
      <TightWrapper>
        <BibleCard reference="JHN.3.16" versionId={3034} />
      </TightWrapper>,
    )

    expect(queryByText('John 3:16 NIV')).toBeNull()

    await act(async () => {
      resolveRefused(null)
    })

    expect(queryByText('John 3:16 NIV')).toBeNull()
  })

  it('clears chrome metadata synchronously when the content client identity changes', async () => {
    function AppKeyWrapper({ appKey, children }: { appKey: string; children: ReactNode }) {
      return (
        <YouVersionProvider appKey={appKey} theme="light" hookOverrides={defaultHookOverrides}>
          {children}
        </YouVersionProvider>
      )
    }

    const { getByText, queryByText, rerender } = await renderAndSettle(
      <AppKeyWrapper appKey="test-key">
        <BibleCard reference="JHN.3.16" versionId={3034} />
      </AppKeyWrapper>,
    )

    expect(getByText('John 3:16 NIV')).toBeTruthy()

    let resolveNewMetadata: (value: typeof sampleMetadata) => void = () => {}
    jest.spyOn(bibleCardMetadata, 'getBibleCardMetadata').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveNewMetadata = resolve
        }),
    )

    rerender(
      <AppKeyWrapper appKey="other-key">
        <BibleCard reference="JHN.3.16" versionId={3034} />
      </AppKeyWrapper>,
    )

    expect(queryByText('John 3:16 NIV')).toBeNull()

    await act(async () => {
      resolveNewMetadata({ ...sampleMetadata, reference: 'John 3:16', abbreviation: 'NIV' })
    })

    expect(getByText('John 3:16 NIV')).toBeTruthy()
  })

  it('shows a failed verse in the provider locale', async () => {
    fetchStub.passageStatus = 503
    const { getByText } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      {
        wrapper: wrapper('light', 'es'),
      },
    )

    await waitFor(() => {
      expect(getByText(es['generic.requestErrorBody'])).toBeTruthy()
    })
  })

  it('shows a failed verse in the device locale when the provider omits one', async () => {
    fetchStub.passageStatus = 503
    stubDeviceLocale('es-MX', 'es')

    const { getByText } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      {
        wrapper: wrapper(),
      },
    )

    await waitFor(() => {
      expect(getByText(es['generic.requestErrorBody'])).toBeTruthy()
    })
  })

  it('caps the native Card at 700 by default', async () => {
    const { getByTestId, toJSON } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      maxWidth: 700,
    })
    expect(snapshotHasReaderWidthToken(JSON.stringify(toJSON()))).toBe(false)
  })

  it('applies a numeric maxWidth on the native Card', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} maxWidth={480} />,
      { wrapper: wrapper() },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      maxWidth: 480,
    })
  })

  it('applies maxWidth 100% on the native Card', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} maxWidth="100%" />,
      { wrapper: wrapper() },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      maxWidth: '100%',
    })
  })

  it('keeps a centered 600px inner column when maxWidth is 100%', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} maxWidth="100%" />,
      { wrapper: wrapper() },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      maxWidth: '100%',
      width: '100%',
    })
    expect(StyleSheet.flatten(getByTestId('bible-card-inner').props.style)).toMatchObject({
      maxWidth: 600,
      width: '100%',
      alignSelf: 'center',
    })
  })

  it('fills the capped shell without an inner 600px column for numeric maxWidth', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} maxWidth={480} />,
      { wrapper: wrapper() },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card-inner').props.style)).toMatchObject({
      width: '100%',
    })
    expect(StyleSheet.flatten(getByTestId('bible-card-inner').props.style)).not.toHaveProperty(
      'maxWidth',
    )
  })

  it('paints the card from a component theme override', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="GEN.1.1" versionId={1} theme="dark" />,
      { wrapper: wrapper('light') },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      backgroundColor: getTokens('dark').card,
    })
  })

  it('resolves theme="system" to the provider theme', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} theme="system" />,
      { wrapper: wrapper('light') },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      backgroundColor: getTokens('light').card,
    })
  })

  it('uses the provider theme when BibleCard does not set one', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper('dark') },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      backgroundColor: getTokens('dark').card,
    })
  })

  it('uses the color scheme when the provider theme is system', async () => {
    const spy = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark')

    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper('system') },
    )

    try {
      expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
        backgroundColor: getTokens('dark').card,
      })
    } finally {
      spy.mockRestore()
    }
  })

  it('draws the verse at 16px in a serif face', async () => {
    const { getByText } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: wrapper() },
    )

    await waitFor(() => {
      expect(getByText('For God so loved')).toBeTruthy()
    })
    const verse = getByText('For God so loved')
    expect(fontSizeOf(verse)).toBe(16)
    expect(fontFamilyOf(verse)).not.toBe('Inter')
  })

  it('shows the version control when showVersionPicker is true', async () => {
    const { getByTestId, getByText } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} showVersionPicker />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('bible-card-version')).toBeTruthy()
    expect(getByText('NIV')).toBeTruthy()
  })

  it('throws when YouVersionProvider is missing', () => {
    expect(() => render(<BibleCard reference="JHN.1.1" versionId={3034} />)).toThrow(
      'useYouVersion must be used inside of YouVersionProvider',
    )
  })

  it('opens the native footnote sheet with footnote data when no consumer handler is provided', async () => {
    const { getByTestId, queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(queryByTestId('footnote-sheet')).toBeNull()

    await pressFootnote()

    expect(getByTestId('footnote-sheet')).toBeTruthy()
    expect(getByTestId('mock-footnote-verse').children).toContain('1')
  })

  it('passes scriptureDirection to the footnote sheet', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} scriptureDirection="rtl" />,
      { wrapper: wrapper() },
    )

    await pressFootnote()

    expect(getByTestId('mock-footnote-direction').children).toContain('rtl')
  })

  it('invokes consumer onFootnotePress and does not mount the default footnote sheet', async () => {
    const consumer = jest.fn().mockResolvedValue(undefined)
    const { queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} onFootnotePress={consumer} />,
      { wrapper: wrapper() },
    )

    await pressFootnote()

    expect(consumer).toHaveBeenCalledTimes(1)
    expect(consumer).toHaveBeenCalledWith(expect.objectContaining({ verseNum: '1' }))
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('does not open a footnote sheet on web', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })

    const { queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    )

    await pressFootnote()
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('closes the footnote sheet when NativeSheet calls onClose', async () => {
    const { getByTestId, queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    )

    await pressFootnote()
    expect(getByTestId('footnote-sheet')).toBeTruthy()

    fireEvent.press(getByTestId('footnote-sheet-close'))
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('resolves system theme for footnote content when component theme is system', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} theme="system" />,
      { wrapper: wrapper('light') },
    )

    await pressFootnote()

    expect(getByTestId('mock-footnote-theme').children).toContain('light')
  })
})
