import { fireEvent, render } from '@testing-library/react-native'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactNode } from 'react'
import { Platform, Pressable, Text, View } from 'react-native'

import { FONT_FAMILY_TOKEN, INTER_FONT } from '../../lib/reader-fonts'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { stubDeviceLocale } from '../../test-utils/stub-device-locale'
import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleTextView } from '../bible-text-view'
import { YouVersionProvider } from '../youversion-provider'

const EMBED_DEFAULTS = {
  matchContents: true,
  containerStyle: { flex: 0, width: '100%' },
  scrollEnabled: false,
  bounces: false,
  overScrollMode: 'never',
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
} as const

const sampleFootnote: FootnoteData = {
  verseNum: '3',
  notes: [],
  verseHtml: '<p>footnote</p>',
}

type BibleTextViewDomProps = {
  appKey: string
  apiHost?: string
  fetchBibleContent?: unknown
  reference?: string
  versionId?: number
  showVerseNumbers?: boolean
  fontSize?: number
  fontFamily?: string
  theme?: string
  permittedVersionIds?: number[]
  excludedVersionIds?: number[]
  permittedLanguageTags?: string[]
  locale?: string
  dom?: {
    matchContents?: boolean
    containerStyle?: unknown
    scrollEnabled?: boolean
    bounces?: boolean
    overScrollMode?: string
    showsVerticalScrollIndicator?: boolean
    showsHorizontalScrollIndicator?: boolean
  }
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

let latestTextViewDomProps: Partial<BibleTextViewDomProps> = {}

function MockBibleTextViewDOM(props: BibleTextViewDomProps) {
  latestTextViewDomProps = props
  return (
    <View testID="mock-btv-dom">
      <Text testID="mock-app-key">{props.appKey}</Text>
      <Text testID="mock-reference">{props.reference ?? ''}</Text>
      <Text testID="mock-version-id">{String(props.versionId ?? '')}</Text>
      <Text testID="mock-show-verse-numbers">{props.showVerseNumbers === true ? '1' : '0'}</Text>
      <Text testID="mock-font-size">{String(props.fontSize ?? '')}</Text>
      <Text testID="mock-font-family">{props.fontFamily ?? ''}</Text>
      <Text testID="mock-theme">{props.theme ?? ''}</Text>
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

function MockFootnoteContent(props: {
  data: FootnoteData
  theme?: string
  fontSize?: number
  appKey: string
}) {
  return (
    <View testID="mock-footnote-content">
      <Text testID="mock-footnote-verse">{props.data.verseNum}</Text>
      <Text testID="mock-footnote-theme">{props.theme ?? ''}</Text>
      <Text testID="mock-footnote-font-size">{String(props.fontSize ?? '')}</Text>
      <Text testID="mock-footnote-app-key">{props.appKey}</Text>
    </View>
  )
}

describe('BibleTextView', () => {
  const originalOs = Platform.OS

  beforeEach(() => {
    latestTextViewDomProps = {}
    stubDeviceLocale('xx-XX', 'xx')
    setImpl('BibleTextViewDom', MockBibleTextViewDOM)
    setImpl('FootnoteContent', MockFootnoteContent)
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

  it('forwards appKey from YouVersionProvider and passage props to the DOM entry', () => {
    const { getByTestId } = render(
      <BibleTextView reference="JHN.1.1-4" versionId={3034} showVerseNumbers fontSize={18} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('mock-app-key').children).toContain('test-key')
    expect(getByTestId('mock-reference').children).toContain('JHN.1.1-4')
    expect(getByTestId('mock-version-id').children).toContain('3034')
    expect(getByTestId('mock-show-verse-numbers').children).toContain('1')
    expect(getByTestId('mock-font-size').children).toContain('18')
    expect(latestTextViewDomProps.apiHost).toBe('api.youversion.com')
    expect(latestTextViewDomProps.fetchBibleContent).toEqual(expect.any(Function))
  })

  it('forwards a component-level theme override to the DOM entry', () => {
    const { getByTestId } = render(
      <BibleTextView reference="GEN.1.1" versionId={1} theme="dark" />,
      { wrapper: wrapper('light') },
    )

    expect(getByTestId('mock-theme').children).toContain('dark')
  })

  it('resolves system theme to light or dark before it crosses the bridge', () => {
    render(<BibleTextView reference="GEN.1.1" versionId={1} theme="system" />, {
      wrapper: wrapper('light'),
    })

    expect(latestTextViewDomProps.theme).toBe('light')
  })

  it('forwards the provider scheme when the component does not override theme', () => {
    render(<BibleTextView reference="GEN.1.1" versionId={1} />, {
      wrapper: wrapper('dark'),
    })

    expect(latestTextViewDomProps.theme).toBe('dark')
    expect(latestTextViewDomProps).not.toHaveProperty('backgroundColor')
    expect(latestTextViewDomProps).not.toHaveProperty('foregroundColor')
  })

  it('encodes fontFamily as a quote-free token and forwards fontSize as a prop', () => {
    const { getByTestId } = render(
      <BibleTextView reference="GEN.1.1" versionId={1} fontSize={18} fontFamily={INTER_FONT} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('mock-font-size').children).toContain('18')
    expect(getByTestId('mock-font-family').children).toContain(FONT_FAMILY_TOKEN.INTER)
    expect(latestTextViewDomProps.fontFamily).toBe(FONT_FAMILY_TOKEN.INTER)
    expect(latestTextViewDomProps.fontFamily).not.toContain('"')
  })

  it('encodes a quoted custom fontFamily so the bridge value has no double quotes', () => {
    const custom = '"Comic Sans MS", cursive'
    render(<BibleTextView reference="GEN.1.1" versionId={1} fontFamily={custom} />, {
      wrapper: wrapper(),
    })

    expect(latestTextViewDomProps.fontFamily).not.toContain('"')
    expect(latestTextViewDomProps.fontFamily).not.toBe(custom)
  })

  it('applies the embed dom defaults when no dom prop is passed', () => {
    render(<BibleTextView reference="GEN.1.1" versionId={1} />, { wrapper: wrapper() })

    expect(latestTextViewDomProps.dom).toEqual(EMBED_DEFAULTS)
  })

  it('merges a consumer containerStyle after the embed defaults', () => {
    render(
      <BibleTextView reference="GEN.1.1" versionId={1} dom={{ containerStyle: { width: 300 } }} />,
      { wrapper: wrapper() },
    )

    expect(latestTextViewDomProps.dom?.containerStyle).toEqual([
      { flex: 0, width: '100%' },
      { width: 300 },
    ])
  })

  it('restores plain flex sizing when the consumer opts out of matchContents', () => {
    render(<BibleTextView reference="GEN.1.1" versionId={1} dom={{ matchContents: false }} />, {
      wrapper: wrapper(),
    })

    expect(latestTextViewDomProps.dom).toEqual({ matchContents: false })
  })

  it('opens the native footnote sheet with footnote data when no consumer handler is provided', () => {
    const { getByTestId, queryByTestId } = render(
      <BibleTextView reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(queryByTestId('footnote-sheet')).toBeNull()

    fireEvent.press(getByTestId('mock-footnote-trigger'))

    expect(getByTestId('footnote-sheet')).toBeTruthy()
    expect(getByTestId('mock-footnote-verse').children).toContain('3')
    expect(getByTestId('mock-footnote-app-key').children).toContain('test-key')
  })

  it('invokes consumer onFootnotePress and does not mount the default footnote sheet', () => {
    const consumer = jest.fn().mockResolvedValue(undefined)
    const { getByTestId, queryByTestId } = render(
      <BibleTextView reference="JHN.1.1" versionId={3034} onFootnotePress={consumer} />,
      { wrapper: wrapper() },
    )

    fireEvent.press(getByTestId('mock-footnote-trigger'))

    expect(consumer).toHaveBeenCalledTimes(1)
    expect(consumer).toHaveBeenCalledWith(sampleFootnote)
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('throws when YouVersionProvider is missing', () => {
    expect(() => render(<BibleTextView reference="JHN.1.1" versionId={3034} />)).toThrow(
      'useYouVersion must be used inside of YouVersionProvider',
    )
  })

  it('does not wire footnote handling on web', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })

    const { getByTestId, queryByTestId } = render(
      <BibleTextView reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('mock-has-footnote-handler').children).toContain('no')
    fireEvent.press(getByTestId('mock-footnote-trigger'))
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('closes the footnote sheet when NativeSheet calls onClose', () => {
    const { getByTestId, queryByTestId } = render(
      <BibleTextView reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    )

    fireEvent.press(getByTestId('mock-footnote-trigger'))
    expect(getByTestId('footnote-sheet')).toBeTruthy()

    fireEvent.press(getByTestId('footnote-sheet-close'))
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('resolves system theme for footnote content when component theme is system', () => {
    const { getByTestId } = render(
      <BibleTextView reference="JHN.1.1" versionId={3034} theme="system" />,
      { wrapper: wrapper('light') },
    )

    fireEvent.press(getByTestId('mock-footnote-trigger'))

    expect(getByTestId('mock-footnote-theme').children).toContain('light')
  })

  it('forwards version filter lists from YouVersionProvider to the DOM entry', () => {
    render(<BibleTextView reference="JHN.1.1" versionId={3034} />, {
      wrapper: ({ children }: { children: ReactNode }) => (
        <YouVersionProvider
          appKey="test-key"
          theme="light"
          hookOverrides={defaultHookOverrides}
          permittedVersionIds={[111]}
          excludedVersionIds={[3034]}
          permittedLanguageTags={['en']}
        >
          {children}
        </YouVersionProvider>
      ),
    })

    expect(latestTextViewDomProps.permittedVersionIds).toEqual([111])
    expect(latestTextViewDomProps.excludedVersionIds).toEqual([3034])
    expect(latestTextViewDomProps.permittedLanguageTags).toEqual(['en'])
  })

  it('forwards resolved locale from YouVersionProvider to the DOM entry', () => {
    render(<BibleTextView reference="JHN.1.1" versionId={3034} />, {
      wrapper: wrapper('light', 'es'),
    })

    expect(latestTextViewDomProps.locale).toBe('es')
  })

  it('forwards device-resolved locale to the DOM entry when provider locale is omitted', () => {
    stubDeviceLocale('es-MX', 'es')

    render(<BibleTextView reference="JHN.1.1" versionId={3034} />, { wrapper: wrapper() })

    expect(latestTextViewDomProps.locale).toBe('es')
  })
})

describe('the DOM scripture surface (unobservable from layer 3)', () => {
  const source = readFileSync(join(__dirname, '../../dom/bible-text-view.tsx'), 'utf8')

  it('passes resolved theme into the in-WebView YouVersionProvider', () => {
    expect(source).toMatch(/^\s*theme=\{theme\}$/m)
  })

  it('applies fonts as Web SDK props only — no --yv-reader-* stylesheet', () => {
    expect(source).toContain('decodeFontFamilyFromDom')
    expect(source).toMatch(/fontSize=\{fontSize\}/)
    expect(source).toMatch(/fontFamily=\{resolvedFontFamily\}/)
    expect(source).not.toContain('readerRendererCss')
    expect(source).not.toContain('--yv-reader-')
    expect(source).not.toContain('!important')
  })

  it('keeps the embed content-sized so matchContents can measure scripture', () => {
    expect(source).toContain('ContentSizedBody')
  })

  it('keeps content fetches on the native Bible Content Client', () => {
    expect(source).toContain('registerBibleContentAction')
    expect(source).toContain('fetchBibleContent')
    expect(source).not.toMatch(/BibleClient/)
  })
})
