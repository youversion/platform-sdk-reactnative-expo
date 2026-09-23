import { act, fireEvent, render } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type { FootnoteData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import * as ReactNative from 'react-native'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { BIBLE_CARD_VERSION_PERSIST_KEY } from '../../lib/constants'
import { FONT_FAMILY_TOKEN } from '../../lib/reader-fonts'
import {
  bibleCardVersionStoreInitialState,
  useBibleCardVersionStore,
} from '../../stores/bible-card-version-store'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { stubDeviceLocale } from '../../test-utils/stub-device-locale'
import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../theme'
import { BibleCard } from '../bible-card'
import * as bibleCardMetadata from '../bible-card-metadata'
import { YouVersionProvider } from '../youversion-provider'

const sampleFootnote: FootnoteData = {
  verseNum: '3',
  notes: [],
  verseHtml: '<p>footnote</p>',
}

const sampleMetadata = {
  reference: 'John 3:16',
  abbreviation: 'NIV',
  copyright: 'NIV copyright',
  languageTag: 'en',
}

const EMBED_DEFAULTS = {
  matchContents: true,
  containerStyle: { flex: 0, width: '100%' },
  scrollEnabled: false,
  bounces: false,
  overScrollMode: 'never',
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
} as const

type EmbedDomProps = {
  matchContents?: boolean
  containerStyle?: StyleProp<ViewStyle>
  scrollEnabled?: boolean
  bounces?: boolean
  overScrollMode?: string
  showsVerticalScrollIndicator?: boolean
  showsHorizontalScrollIndicator?: boolean
}

type LatestDomProps = {
  appKey?: string
  apiHost?: string
  fetchBibleContent?: unknown
  reference?: string
  versionId?: number
  theme?: string
  locale?: string
  fontSize?: number
  fontFamily?: string
  showVerseNumbers?: boolean
  highlights?: unknown
  permittedVersionIds?: number[]
  excludedVersionIds?: number[]
  permittedLanguageTags?: string[]
  maxWidth?: number | '100%'
  showVersionPicker?: boolean
  onVersionChange?: unknown
  onVersionPickerPress?: unknown
  dom?: EmbedDomProps
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

let latestDomProps: LatestDomProps = {}

async function renderAndSettle(...args: Parameters<typeof render>) {
  const result = render(...args)
  await act(async () => {})
  await act(async () => {})
  return result
}

function MockBibleTextViewDOM(props: LatestDomProps) {
  latestDomProps = props
  return (
    <View testID="mock-btv-dom">
      <Text testID="mock-app-key">{props.appKey}</Text>
      <Text testID="mock-reference">{props.reference ?? ''}</Text>
      <Text testID="mock-version-id">{String(props.versionId ?? '')}</Text>
      <Text testID="mock-theme">{props.theme ?? ''}</Text>
      <Text testID="mock-font-size">{String(props.fontSize ?? '')}</Text>
      <Text testID="mock-font-family">{props.fontFamily ?? ''}</Text>
      <Text testID="mock-show-verse-numbers">{props.showVerseNumbers === true ? '1' : '0'}</Text>
      <Text testID="mock-dom-match-contents">{props.dom?.matchContents === true ? '1' : '0'}</Text>
      <Text testID="mock-has-footnote-handler">{props.onFootnotePress ? 'yes' : 'no'}</Text>
      <Pressable
        testID="mock-footnote-trigger"
        onPress={() => void props.onFootnotePress?.(sampleFootnote)}
      >
        <Text>footnote</Text>
      </Pressable>
    </View>
  )
}

function MockFootnoteContent(props: { data: FootnoteData; theme?: string; appKey: string }) {
  return (
    <View testID="mock-footnote-content">
      <Text testID="mock-footnote-verse">{props.data.verseNum}</Text>
      <Text testID="mock-footnote-theme">{props.theme ?? ''}</Text>
      <Text testID="mock-footnote-app-key">{props.appKey}</Text>
    </View>
  )
}

function snapshotHasReaderWidthToken(snapshot: string): boolean {
  return snapshot.includes('--yv-reader-max-width') || snapshot.includes('65ch')
}

describe('BibleCard', () => {
  const originalOs = Platform.OS

  beforeEach(async () => {
    latestDomProps = {}
    stubDeviceLocale('xx-XX', 'xx')
    setImpl('BibleTextViewDom', MockBibleTextViewDOM)
    setImpl('FootnoteContent', MockFootnoteContent)
    setImpl('BibleAppLogo', () => <View testID="bible-app-logo" />)
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
    resetImpls()
    jest.restoreAllMocks()
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: originalOs,
    })
  })

  it('renders native chrome around the DOM BibleTextView', async () => {
    const { getByTestId, getByText, queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('bible-card')).toBeTruthy()
    expect(getByText('John 3:16 NIV')).toBeTruthy()
    expect(getByText('NIV copyright')).toBeTruthy()
    expect(getByTestId('bible-card-attribution')).toBeTruthy()
    expect(getByText('Bible App')).toBeTruthy()
    expect(getByTestId('mock-btv-dom')).toBeTruthy()
    expect(queryByTestId('bible-card-version')).toBeNull()
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
    expect(latestDomProps.theme).toBe('dark')
  })

  it('clears chrome metadata synchronously when reference changes', async () => {
    const TestWrapper = wrapper()
    const { getByText, queryByText, rerender } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: TestWrapper },
    )

    expect(getByText('John 3:16 NIV')).toBeTruthy()

    let resolveNewMetadata: (value: typeof sampleMetadata) => void = () => {}
    jest.spyOn(bibleCardMetadata, 'getBibleCardMetadata').mockImplementation((_fetch, _versionId, passageId) => {
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

  it('forwards appKey from YouVersionProvider and passage props to BibleTextView', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} dom={{ matchContents: true }} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('mock-app-key').children).toContain('test-key')
    expect(getByTestId('mock-reference').children).toContain('JHN.3.16')
    expect(getByTestId('mock-version-id').children).toContain('3034')
    expect(getByTestId('mock-show-verse-numbers').children).toContain('0')
    expect(getByTestId('mock-dom-match-contents').children).toContain('1')
    expect(latestDomProps.apiHost).toBe('api.youversion.com')
    expect(latestDomProps.fetchBibleContent).toEqual(expect.any(Function))
    expect(latestDomProps).not.toHaveProperty('showVersionPicker')
    expect(latestDomProps).not.toHaveProperty('onVersionPickerPress')
    expect(latestDomProps).not.toHaveProperty('onVersionChange')
    expect(latestDomProps).not.toHaveProperty('maxWidth')
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

  it('forwards version filter lists from YouVersionProvider to BibleTextView', async () => {
    await renderAndSettle(<BibleCard reference="JHN.3.16" versionId={3034} />, {
      wrapper: versionFilterWrapper({
        permittedVersionIds: [111],
        excludedVersionIds: [3034],
        permittedLanguageTags: ['en'],
      }),
    })

    expect(latestDomProps.permittedVersionIds).toEqual([111])
    expect(latestDomProps.excludedVersionIds).toEqual([3034])
    expect(latestDomProps.permittedLanguageTags).toEqual(['en'])
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

    const { queryByText, queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      {
        wrapper: versionFilterWrapper({
          permittedVersionIds: [],
        }),
      },
    )

    expect(queryByText('John 3:16 NIV')).toBeNull()
    expect(queryByText('NIV copyright')).toBeNull()
    expect(queryByTestId('mock-btv-dom')).toBeTruthy()
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

  it('forwards resolved locale from YouVersionProvider to BibleTextView', async () => {
    await renderAndSettle(<BibleCard reference="JHN.3.16" versionId={3034} />, {
      wrapper: wrapper('light', 'es'),
    })

    expect(latestDomProps.locale).toBe('es')
  })

  it('forwards device-resolved locale to BibleTextView when provider locale is omitted', async () => {
    stubDeviceLocale('es-MX', 'es')

    await renderAndSettle(<BibleCard reference="JHN.3.16" versionId={3034} />, {
      wrapper: wrapper(),
    })

    expect(latestDomProps.locale).toBe('es')
  })

  it('applies the embed dom defaults when no dom prop is passed', async () => {
    await renderAndSettle(<BibleCard reference="JHN.3.16" versionId={3034} />, {
      wrapper: wrapper(),
    })

    expect(latestDomProps.dom).toEqual(EMBED_DEFAULTS)
  })

  it('merges a consumer containerStyle after the embed defaults', async () => {
    await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} dom={{ containerStyle: { width: 300 } }} />,
      { wrapper: wrapper() },
    )

    expect(latestDomProps.dom?.containerStyle).toEqual([{ flex: 0, width: '100%' }, { width: 300 }])
  })

  it('caps the native Card at 700 by default and does not forward maxWidth to BibleTextView', async () => {
    const { getByTestId, toJSON } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      maxWidth: 700,
    })
    expect(latestDomProps.maxWidth).toBeUndefined()
    expect(snapshotHasReaderWidthToken(JSON.stringify(latestDomProps))).toBe(false)
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
    expect(latestDomProps.maxWidth).toBeUndefined()
  })

  it('applies maxWidth 100% on the native Card', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} maxWidth="100%" />,
      { wrapper: wrapper() },
    )

    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      maxWidth: '100%',
    })
    expect(latestDomProps.maxWidth).toBeUndefined()
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

  it('forwards a component-level theme override to BibleTextView as light or dark', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="GEN.1.1" versionId={1} theme="dark" />,
      { wrapper: wrapper('light') },
    )

    expect(getByTestId('mock-theme').children).toContain('dark')
    expect(StyleSheet.flatten(getByTestId('bible-card').props.style)).toMatchObject({
      backgroundColor: getTokens('dark').card,
    })
  })

  it('resolves theme="system" to the provider theme before passing to BibleTextView', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} theme="system" />,
      { wrapper: wrapper('light') },
    )

    expect(getByTestId('mock-theme').children).toContain('light')
  })

  it('uses the provider-resolved theme when BibleCard does not set theme', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper('dark') },
    )

    expect(getByTestId('mock-theme').children).toContain('dark')
  })

  it('uses provider-resolved theme when provider theme is system and color scheme is dark', async () => {
    const spy = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark')

    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper('system') },
    )

    try {
      expect(getByTestId('mock-theme').children).toContain('dark')
    } finally {
      spy.mockRestore()
    }
  })

  it('encodes the serif face and a 16px verse', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.3.16" versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('mock-font-size').children).toContain('16')
    expect(getByTestId('mock-font-family').children).toContain(FONT_FAMILY_TOKEN.UNTITLED_SERIF)
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

    fireEvent.press(getByTestId('mock-footnote-trigger'))

    expect(getByTestId('footnote-sheet')).toBeTruthy()
    expect(getByTestId('mock-footnote-verse').children).toContain('3')
    expect(getByTestId('mock-footnote-app-key').children).toContain('test-key')
  })

  it('invokes consumer onFootnotePress and does not mount the default footnote sheet', async () => {
    const consumer = jest.fn().mockResolvedValue(undefined)
    const { getByTestId, queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} onFootnotePress={consumer} />,
      { wrapper: wrapper() },
    )

    fireEvent.press(getByTestId('mock-footnote-trigger'))

    expect(consumer).toHaveBeenCalledTimes(1)
    expect(consumer).toHaveBeenCalledWith(sampleFootnote)
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('does not wire footnote handling on web', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })

    const { getByTestId, queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('mock-has-footnote-handler').children).toContain('no')
    fireEvent.press(getByTestId('mock-footnote-trigger'))
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('closes the footnote sheet when NativeSheet calls onClose', async () => {
    const { getByTestId, queryByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    )

    fireEvent.press(getByTestId('mock-footnote-trigger'))
    expect(getByTestId('footnote-sheet')).toBeTruthy()

    fireEvent.press(getByTestId('footnote-sheet-close'))
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('resolves system theme for footnote content when component theme is system', async () => {
    const { getByTestId } = await renderAndSettle(
      <BibleCard reference="JHN.1.1" versionId={3034} theme="system" />,
      { wrapper: wrapper('light') },
    )

    fireEvent.press(getByTestId('mock-footnote-trigger'))

    expect(getByTestId('mock-footnote-theme').children).toContain('light')
  })
})
