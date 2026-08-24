import { fireEvent, render } from '@testing-library/react-native'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import * as ReactNative from 'react-native'
import { Platform } from 'react-native'
import type { ReactNode } from 'react'

import { BibleCard } from '../bible-card'
import { YouVersionProvider } from '../youversion-provider'
import {
  bibleCardVersionStoreInitialState,
  useBibleCardVersionStore,
} from '../../stores/bible-card-version-store'
import { BIBLE_CARD_VERSION_PERSIST_KEY } from '../../lib/constants'
import { youVersionProviderWrapper as wrapper } from '../../test-utils/youversion-provider-wrapper'

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageTag: 'xx-XX', languageCode: 'xx' }]),
  useLocales: jest.fn(() => [{ languageTag: 'xx-XX', languageCode: 'xx' }]),
}))

const useLocalesMock = jest.requireMock('expo-localization').useLocales as jest.Mock

const sampleFootnote: FootnoteData = {
  verseNum: '3',
  notes: [],
  verseHtml: '<p>footnote</p>',
}

jest.mock('../bible-version-picker-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    BibleVersionPickerSheet: () => <View testID="mock-version-picker-sheet-stub" />,
  }
})

jest.mock('../native-sheet', () => {
  const actual = jest.requireActual('../native-sheet')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text, View } = require('react-native')
  return {
    ...actual,
    NativeSheet: ({
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
  }
})

jest.mock('../../dom/footnote-content', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text, View } = require('react-native')
  return {
    __esModule: true,
    default: function MockFootnoteContent(props: {
      data: FootnoteData
      theme?: string
      appKey: string
    }) {
      return (
        <View testID="mock-footnote-content">
          <Text testID="mock-footnote-verse">{props.data.verseNum}</Text>
          <Text testID="mock-footnote-theme">{props.theme ?? ''}</Text>
          <Text testID="mock-footnote-app-key">{props.appKey}</Text>
        </View>
      )
    },
  }
})

let latestDomProps: {
  dom?: { matchContents?: boolean; containerStyle?: unknown }
  locale?: string
  permittedVersionIds?: number[]
  excludedVersionIds?: number[]
  permittedLanguageTags?: string[]
  maxWidth?: number | '100%'
} = {}

jest.mock('../../dom/bible-card', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text, View } = require('react-native')
  return {
    __esModule: true,
    default: function MockBibleCardDOM(props: {
      appKey: string
      reference?: string
      versionId?: number
      theme?: string
      locale?: string
      maxWidth?: number | '100%'
      dom?: { matchContents?: boolean; containerStyle?: unknown }
      onFootnotePress?: (data: FootnoteData) => Promise<void>
    }) {
      latestDomProps = props
      return (
        <View testID="mock-bible-card-dom">
          <Text testID="mock-app-key">{props.appKey}</Text>
          <Text testID="mock-reference">{props.reference ?? ''}</Text>
          <Text testID="mock-version-id">{String(props.versionId ?? '')}</Text>
          <Text testID="mock-theme">{props.theme ?? ''}</Text>
          <Text testID="mock-dom-match-contents">
            {props.dom?.matchContents === true ? '1' : '0'}
          </Text>
          <Text testID="mock-has-footnote-handler">
            {typeof props.onFootnotePress === 'function' ? 'yes' : 'no'}
          </Text>
          <Pressable
            testID="mock-footnote-trigger"
            onPress={() => void props.onFootnotePress?.(sampleFootnote)}
          >
            <Text>footnote</Text>
          </Pressable>
        </View>
      )
    },
  }
})

function styleHasMaxWidth(style: unknown): boolean {
  if (style == null) return false
  if (Array.isArray(style)) return style.some(styleHasMaxWidth)
  if (typeof style !== 'object') return false
  return 'maxWidth' in style
}

function treeHasMaxWidthStyle(node: unknown): boolean {
  if (node == null || typeof node !== 'object') return false
  if (Array.isArray(node)) return node.some(treeHasMaxWidthStyle)

  const record = node as { props?: { style?: unknown }; children?: unknown }
  return styleHasMaxWidth(record.props?.style) || treeHasMaxWidthStyle(record.children)
}

function containsReaderWidthToken(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') {
    return value.includes('--yv-reader-max-width') || value.includes('65ch')
  }
  if (typeof value === 'number' || typeof value === 'boolean') return false
  if (Array.isArray(value)) return value.some(containsReaderWidthToken)
  if (typeof value !== 'object') return false
  return Object.entries(value).some(
    ([key, nested]) => containsReaderWidthToken(key) || containsReaderWidthToken(nested),
  )
}

describe('BibleCard', () => {
  const originalOs = Platform.OS

  beforeEach(async () => {
    latestDomProps = {}
    useLocalesMock.mockReturnValue([{ languageTag: 'xx-XX', languageCode: 'xx' }])
    mmkvStorage.remove(BIBLE_CARD_VERSION_PERSIST_KEY)
    useBibleCardVersionStore.setState(bibleCardVersionStoreInitialState)
    await useBibleCardVersionStore.persist.rehydrate()
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: originalOs,
    })
  })

  it('forwards appKey from YouVersionProvider and passage props to the DOM entry', () => {
    const { getByTestId } = render(
      <BibleCard reference="JHN.3.16" versionId={3034} dom={{ matchContents: true }} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('mock-app-key').children).toContain('test-key')
    expect(getByTestId('mock-reference').children).toContain('JHN.3.16')
    expect(getByTestId('mock-version-id').children).toContain('3034')
    expect(getByTestId('mock-dom-match-contents').children).toContain('1')
  })

  function versionFilterWrapper(lists: {
    permittedVersionIds?: number[]
    excludedVersionIds?: number[]
    permittedLanguageTags?: string[]
  }) {
    function FilterWrapper({ children }: { children: ReactNode }) {
      return (
        <YouVersionProvider appKey="test-key" theme="light" {...lists}>
          {children}
        </YouVersionProvider>
      )
    }
    return FilterWrapper
  }

  it('forwards version filter lists from YouVersionProvider to the DOM entry', () => {
    render(<BibleCard reference="JHN.3.16" versionId={3034} />, {
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

  it('forwards resolved locale from YouVersionProvider to the DOM entry', () => {
    render(<BibleCard reference="JHN.3.16" versionId={3034} />, {
      wrapper: wrapper('light', 'es'),
    })

    expect(latestDomProps.locale).toBe('es')
  })

  it('forwards device-resolved locale to the DOM entry when provider locale is omitted', () => {
    useLocalesMock.mockReturnValue([{ languageTag: 'es-MX', languageCode: 'es' }])

    render(<BibleCard reference="JHN.3.16" versionId={3034} />, { wrapper: wrapper() })

    expect(latestDomProps.locale).toBe('es')
  })

  it('applies the embed dom defaults when no dom prop is passed', () => {
    render(<BibleCard reference="JHN.3.16" versionId={3034} />, {
      wrapper: wrapper(),
    })

    expect(latestDomProps.dom).toEqual({
      matchContents: true,
      containerStyle: { flex: 0, width: '100%' },
      scrollEnabled: false,
      bounces: false,
      overScrollMode: 'never',
      showsVerticalScrollIndicator: false,
      showsHorizontalScrollIndicator: false,
    })
  })

  it('merges a consumer containerStyle after the embed defaults', () => {
    render(
      <BibleCard reference="JHN.3.16" versionId={3034} dom={{ containerStyle: { width: 300 } }} />,
      { wrapper: wrapper() },
    )

    expect(latestDomProps.dom?.containerStyle).toEqual([{ flex: 0, width: '100%' }, { width: 300 }])
  })

  it('forwards maxWidth to the web card without a native wrapper or reader-width style', () => {
    const { toJSON } = render(<BibleCard reference="JHN.3.16" versionId={3034} maxWidth={480} />, {
      wrapper: wrapper(),
    })

    expect(latestDomProps.maxWidth).toBe(480)
    expect(styleHasMaxWidth(latestDomProps.dom?.containerStyle)).toBe(false)
    expect(treeHasMaxWidthStyle(toJSON())).toBe(false)
    expect(containsReaderWidthToken(latestDomProps)).toBe(false)
    expect(containsReaderWidthToken(toJSON())).toBe(false)
  })

  it('forwards maxWidth 100% to the web card without a native wrapper or reader-width style', () => {
    const { toJSON } = render(<BibleCard reference="JHN.3.16" versionId={3034} maxWidth="100%" />, {
      wrapper: wrapper(),
    })

    expect(latestDomProps.maxWidth).toBe('100%')
    expect(styleHasMaxWidth(latestDomProps.dom?.containerStyle)).toBe(false)
    expect(treeHasMaxWidthStyle(toJSON())).toBe(false)
    expect(containsReaderWidthToken(latestDomProps)).toBe(false)
    expect(containsReaderWidthToken(toJSON())).toBe(false)
  })

  it('forwards a component-level theme override to the DOM entry', () => {
    const { getByTestId } = render(<BibleCard reference="GEN.1.1" versionId={1} theme="dark" />, {
      wrapper: wrapper('light'),
    })

    expect(getByTestId('mock-theme').children).toContain('dark')
  })

  it('resolves theme="system" to the provider theme before passing to the DOM entry', () => {
    const { getByTestId } = render(
      <BibleCard reference="JHN.1.1" versionId={3034} theme="system" />,
      { wrapper: wrapper('light') },
    )

    expect(getByTestId('mock-theme').children).toContain('light')
  })

  it('uses the provider-resolved theme when BibleCard does not set theme', () => {
    const { getByTestId } = render(<BibleCard reference="JHN.1.1" versionId={3034} />, {
      wrapper: wrapper('dark'),
    })

    expect(getByTestId('mock-theme').children).toContain('dark')
  })

  it('uses provider-resolved theme when provider theme is system and color scheme is dark', () => {
    const spy = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark')

    const { getByTestId } = render(<BibleCard reference="JHN.1.1" versionId={3034} />, {
      wrapper: wrapper('system'),
    })

    try {
      expect(getByTestId('mock-theme').children).toContain('dark')
    } finally {
      spy.mockRestore()
    }
  })

  it('throws when YouVersionProvider is missing', () => {
    expect(() => render(<BibleCard reference="JHN.1.1" versionId={3034} />)).toThrow(
      'YouVersionProvider is required. Wrap your app with <YouVersionProvider appKey="...">.',
    )
  })

  it('opens the native footnote sheet with footnote data when no consumer handler is provided', () => {
    const { getByTestId, queryByTestId } = render(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
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
      <BibleCard reference="JHN.1.1" versionId={3034} onFootnotePress={consumer} />,
      { wrapper: wrapper() },
    )

    fireEvent.press(getByTestId('mock-footnote-trigger'))

    expect(consumer).toHaveBeenCalledTimes(1)
    expect(consumer).toHaveBeenCalledWith(sampleFootnote)
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('does not wire footnote handling on web', () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: 'web',
    })

    const { getByTestId, queryByTestId } = render(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    )

    expect(getByTestId('mock-has-footnote-handler').children).toContain('no')
    fireEvent.press(getByTestId('mock-footnote-trigger'))
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('closes the footnote sheet when NativeSheet calls onClose', () => {
    const { getByTestId, queryByTestId } = render(
      <BibleCard reference="JHN.1.1" versionId={3034} />,
      { wrapper: wrapper() },
    )

    fireEvent.press(getByTestId('mock-footnote-trigger'))
    expect(getByTestId('footnote-sheet')).toBeTruthy()

    fireEvent.press(getByTestId('footnote-sheet-close'))
    expect(queryByTestId('footnote-sheet')).toBeNull()
  })

  it('resolves system theme for footnote content when component theme is system', () => {
    const { getByTestId } = render(
      <BibleCard reference="JHN.1.1" versionId={3034} theme="system" />,
      { wrapper: wrapper('light') },
    )

    fireEvent.press(getByTestId('mock-footnote-trigger'))

    expect(getByTestId('mock-footnote-theme').children).toContain('light')
  })
})
