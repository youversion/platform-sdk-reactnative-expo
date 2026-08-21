import { fireEvent, render } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { BIBLE_READER_FONT } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { FONT_FAMILY_TOKEN, INTER_FONT, UNTITLED_SERIF_FONT } from '../../lib/reader-fonts'
import { useReaderSettingsStore } from '../../stores/reader-settings-store'
import { READER_LINE_SPACING } from '../../stores/types/reader-line-spacing'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { stubDeviceLocale } from '../../test-utils/stub-device-locale'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReaderSettingsSheet } from '../bible-reader-settings-sheet'

type LatestDomProps = {
  fontSize: number
  fontFamily: string
  lineSpacing: number
  locale?: string
  onFontIncreased: () => Promise<void>
  onFontDecreased: () => Promise<void>
  onFontSelected: (next: string) => Promise<void>
  onLineSpacingChange: () => Promise<void>
}

let latestDomProps: LatestDomProps | Record<string, never> = {}

function MockDOM(props: LatestDomProps) {
  latestDomProps = props
  return (
    <View testID="mock-dom">
      <Text testID="font-size">{String(props.fontSize)}</Text>
      <Text testID="font-family">{props.fontFamily}</Text>
      <Text testID="line-spacing">{String(props.lineSpacing)}</Text>
      <Pressable testID="increase" onPress={() => props.onFontIncreased()}>
        <Text>A+</Text>
      </Pressable>
      <Pressable testID="decrease" onPress={() => props.onFontDecreased()}>
        <Text>A-</Text>
      </Pressable>
      <Pressable testID="select-inter" onPress={() => props.onFontSelected('"Inter", sans-serif')}>
        <Text>Inter</Text>
      </Pressable>
      <Pressable testID="cycle-line-spacing" onPress={() => props.onLineSpacingChange()}>
        <Text>Line spacing</Text>
      </Pressable>
    </View>
  )
}

const wrapper = youVersionProviderWrapper()

function SheetHarness({ isOpen }: { isOpen: boolean }) {
  // Subscribe here so we can read the latest values back out via testIDs and
  // confirm that handler calls round-trip through persisted settings.
  const { fontSize, fontFamily, lineSpacing } = useReaderSettingsStore(
    useShallow((s) => ({
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      lineSpacing: s.lineSpacing,
    })),
  )
  return (
    <>
      <View testID="harness-font-size">
        <Text>{String(fontSize)}</Text>
      </View>
      <View testID="harness-font-family">
        <Text>{fontFamily}</Text>
      </View>
      <View testID="harness-line-spacing">
        <Text>{String(lineSpacing)}</Text>
      </View>
      <BibleReaderSettingsSheet isSettingsSheetOpen={isOpen} onClose={() => {}} />
    </>
  )
}

describe('BibleReaderSettingsSheet', () => {
  beforeEach(() => {
    latestDomProps = {}
    stubDeviceLocale('xx-XX', 'xx')
    setImpl('BibleReaderSettings', MockDOM)
    setImpl('NativeSheet', ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
      isOpen ? <View testID="sheet">{children}</View> : null,
    )
    mmkvStorage.clearAll()
    useReaderSettingsStore.setState({
      fontSize: BIBLE_READER_FONT.DEFAULT,
      fontFamily: UNTITLED_SERIF_FONT,
      lineSpacing: READER_LINE_SPACING.DEFAULT,
    })
    return useReaderSettingsStore.persist.rehydrate()
  })

  afterEach(() => {
    resetImpls()
    jest.restoreAllMocks()
  })

  it('renders nothing when isOpen is false', () => {
    const { queryByTestId } = render(<SheetHarness isOpen={false} />, {
      wrapper,
    })

    expect(queryByTestId('sheet')).toBeNull()
    expect(queryByTestId('mock-dom')).toBeNull()
  })

  it('renders the DOM content with current settings when open', () => {
    const { getByTestId } = render(<SheetHarness isOpen />, { wrapper })

    expect(getByTestId('sheet')).toBeTruthy()
    expect(getByTestId('font-size').children).toContain(String(BIBLE_READER_FONT.DEFAULT))
    // fontFamily crosses the bridge as a quote-free token (the canonical stack
    // contains a `"`, which @expo/dom-webview corrupts on iOS); the DOM
    // component decodes it back to UNTITLED_SERIF_FONT for the Web SDK.
    expect(getByTestId('font-family').children).toContain(FONT_FAMILY_TOKEN.UNTITLED_SERIF)
    expect(getByTestId('line-spacing').children).toContain(String(READER_LINE_SPACING.DEFAULT))
  })

  it('increase/decrease handlers step font size by STEP and clamp at bounds', () => {
    const { getByTestId } = render(<SheetHarness isOpen />, { wrapper })

    fireEvent.press(getByTestId('increase'))
    expect(getByTestId('harness-font-size').children[0]).toHaveProperty(
      'props.children',
      String(BIBLE_READER_FONT.DEFAULT + BIBLE_READER_FONT.STEP),
    )

    // Drop straight to MIN: spam decrease past the lower bound.
    for (let i = 0; i < 10; i++) {
      fireEvent.press(getByTestId('decrease'))
    }
    expect(getByTestId('harness-font-size').children[0]).toHaveProperty(
      'props.children',
      String(BIBLE_READER_FONT.MIN),
    )
  })

  it('font-family handler swaps the persisted family', () => {
    const { getByTestId } = render(<SheetHarness isOpen />, { wrapper })

    fireEvent.press(getByTestId('select-inter'))
    expect(getByTestId('harness-font-family').children[0]).toHaveProperty(
      'props.children',
      INTER_FONT,
    )
  })

  it('line-spacing handler cycles the persisted spacing DEFAULT -> LG', () => {
    const { getByTestId } = render(<SheetHarness isOpen />, { wrapper })

    fireEvent.press(getByTestId('cycle-line-spacing'))
    expect(getByTestId('harness-line-spacing').children[0]).toHaveProperty(
      'props.children',
      String(READER_LINE_SPACING.LG),
    )
  })

  it('forwards resolved locale from YouVersionProvider to the DOM entry', () => {
    render(<SheetHarness isOpen />, {
      wrapper: youVersionProviderWrapper('light', 'es'),
    })

    expect(latestDomProps.locale).toBe('es')
  })

  it('forwards device-resolved locale to the DOM entry when provider locale is omitted', () => {
    stubDeviceLocale('es-MX', 'es')

    render(<SheetHarness isOpen />, { wrapper })

    expect(latestDomProps.locale).toBe('es')
  })
})
