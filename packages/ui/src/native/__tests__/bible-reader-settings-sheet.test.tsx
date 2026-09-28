import { act, fireEvent, render } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { BIBLE_READER_FONT } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'

import en from '../../i18n/locales/en.json'
import es from '../../i18n/locales/es.json'
import { SHEET_SURFACE } from '../../lib/native-sheet-theme'
import { INTER_FONT, UNTITLED_SERIF_FONT } from '../../lib/reader-fonts'
import { useReaderSettingsStore } from '../../stores/reader-settings-store'
import { READER_LINE_SPACING } from '../../stores/types/reader-line-spacing'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { stubDeviceLocale } from '../../test-utils/stub-device-locale'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../theme'
import { BibleReaderSettingsSheet } from '../bible-reader-settings-sheet'

let latestSheetTheme: string | undefined
let latestBottomInsetColor: string | undefined

const wrapper = youVersionProviderWrapper()

function SheetHarness({ isOpen, theme }: { isOpen: boolean; theme?: 'light' | 'dark' }) {
  return <BibleReaderSettingsSheet isSettingsSheetOpen={isOpen} onClose={() => {}} theme={theme} />
}

function flattenedStyle(style: StyleProp<ViewStyle>) {
  return StyleSheet.flatten(style)
}

function flattenedTextStyle(style: StyleProp<TextStyle>) {
  return StyleSheet.flatten(style)
}

describe('BibleReaderSettingsSheet', () => {
  beforeEach(() => {
    latestSheetTheme = undefined
    latestBottomInsetColor = undefined
    stubDeviceLocale('xx-XX', 'xx')
    setImpl(
      'NativeSheet',
      ({
        isOpen,
        theme,
        headerTitle,
        bottomInsetColor,
        children,
      }: {
        isOpen: boolean
        theme?: string
        headerTitle?: string
        bottomInsetColor?: string
        children: ReactNode
      }) => {
        latestSheetTheme = theme
        latestBottomInsetColor = bottomInsetColor
        if (!isOpen) {
          return null
        }
        return (
          <View testID="sheet">
            <Text testID="sheet-title">{headerTitle}</Text>
            {children}
          </View>
        )
      },
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

  it('renders nothing when the sheet is closed', () => {
    const { queryByTestId } = render(<SheetHarness isOpen={false} />, { wrapper })

    expect(queryByTestId('sheet')).toBeNull()
    expect(queryByTestId('bible-reader-settings')).toBeNull()
  })

  it('renders the font controls with readable font names', () => {
    const { getByTestId, getByRole, getByText, getAllByText, queryByText } = render(<SheetHarness isOpen />, {
      wrapper,
    })

    expect(getByRole('button', { name: en.decreaseFontSizeAriaLabel })).toBeTruthy()
    expect(getByRole('button', { name: en.increaseFontSizeAriaLabel })).toBeTruthy()
    expect(getByRole('button', { name: en.changeLineSpacingAriaLabel })).toBeTruthy()
    expect(getByRole('button', { name: en.interFontName })).toBeTruthy()
    expect(getByRole('button', { name: en.untitledSerifFontName })).toBeTruthy()
    expect(getAllByText('Font')).toHaveLength(2)
    expect(getByText('Inter')).toBeTruthy()
    expect(getByText('Untitled Serif')).toBeTruthy()
    expect(queryByText('interFontName')).toBeNull()
    expect(queryByText('untitledSerifFontName')).toBeNull()
    expect(flattenedTextStyle(getByText('Inter').props.style).fontFamily).toBe('Inter')
    expect(flattenedTextStyle(getByText('Untitled Serif').props.style).fontFamily).toBe(
      'Untitled Serif',
    )
    expect(flattenedStyle(getByTestId('bible-reader-settings').props.style).gap).toBe(16)
    expect(getByTestId('font-serif').props.accessibilityState).toMatchObject({ selected: true })
  })

  it('disables decrease at the minimum font size and increase at the maximum', () => {
    useReaderSettingsStore.setState({ fontSize: BIBLE_READER_FONT.MIN })
    const { getByTestId, rerender } = render(<SheetHarness isOpen />, { wrapper })

    expect(getByTestId('decrease-font-size').props.accessibilityState).toMatchObject({
      disabled: true,
    })
    expect(getByTestId('increase-font-size').props.accessibilityState).not.toMatchObject({
      disabled: true,
    })

    act(() => {
      useReaderSettingsStore.setState({ fontSize: BIBLE_READER_FONT.MAX })
    })
    rerender(<SheetHarness isOpen />)

    expect(getByTestId('increase-font-size').props.accessibilityState).toMatchObject({
      disabled: true,
    })
    expect(getByTestId('decrease-font-size').props.accessibilityState).not.toMatchObject({
      disabled: true,
    })
  })

  it('steps font size through the handler and stops at the bounds', () => {
    const { getByTestId } = render(<SheetHarness isOpen />, { wrapper })

    fireEvent.press(getByTestId('increase-font-size'))
    expect(useReaderSettingsStore.getState().fontSize).toBe(
      BIBLE_READER_FONT.DEFAULT + BIBLE_READER_FONT.STEP,
    )

    for (let i = 0; i < 10; i++) {
      fireEvent.press(getByTestId('decrease-font-size'))
    }
    expect(useReaderSettingsStore.getState().fontSize).toBe(BIBLE_READER_FONT.MIN)
    expect(getByTestId('decrease-font-size').props.accessibilityState).toMatchObject({
      disabled: true,
    })
  })

  it('cycles line spacing from the default through large and small', () => {
    const { getByTestId } = render(<SheetHarness isOpen />, { wrapper })

    fireEvent.press(getByTestId('line-spacing'))
    expect(useReaderSettingsStore.getState().lineSpacing).toBe(READER_LINE_SPACING.LG)

    fireEvent.press(getByTestId('line-spacing'))
    expect(useReaderSettingsStore.getState().lineSpacing).toBe(READER_LINE_SPACING.SM)

    fireEvent.press(getByTestId('line-spacing'))
    expect(useReaderSettingsStore.getState().lineSpacing).toBe(READER_LINE_SPACING.DEFAULT)
  })

  it('stores the chosen font family and marks that choice selected', () => {
    const { getByTestId } = render(<SheetHarness isOpen />, { wrapper })
    const light = getTokens('light')

    fireEvent.press(getByTestId('font-inter'))

    expect(useReaderSettingsStore.getState().fontFamily).toBe(INTER_FONT)
    expect(getByTestId('font-inter').props.accessibilityState).toMatchObject({ selected: true })
    expect(flattenedStyle(getByTestId('font-inter').props.style).backgroundColor).toBe(
      light.foreground,
    )
    expect(getByTestId('font-serif').props.accessibilityState).toMatchObject({ selected: false })

    fireEvent.press(getByTestId('font-serif'))

    expect(useReaderSettingsStore.getState().fontFamily).toBe(UNTITLED_SERIF_FONT)
    expect(getByTestId('font-serif').props.accessibilityState).toMatchObject({ selected: true })
  })

  it('paints the sheet and the controls from an explicit theme', () => {
    const { getByTestId, getByText, rerender } = render(<SheetHarness isOpen />, { wrapper })
    const light = getTokens('light')
    const dark = getTokens('dark')

    expect(latestSheetTheme).toBe('light')
    expect(latestBottomInsetColor).toBe(SHEET_SURFACE.light)
    expect(flattenedStyle(getByTestId('bible-reader-settings').props.style).backgroundColor).toBe(
      light.background,
    )
    expect(flattenedStyle(getByTestId('line-spacing-bar').props.style).backgroundColor).toBe(
      light.foreground,
    )

    rerender(<SheetHarness isOpen theme="dark" />)

    expect(latestSheetTheme).toBe('dark')
    expect(latestBottomInsetColor).toBe(SHEET_SURFACE.dark)
    expect(flattenedStyle(getByTestId('bible-reader-settings').props.style).backgroundColor).toBe(
      dark.background,
    )
    expect(flattenedStyle(getByTestId('line-spacing-bar').props.style).backgroundColor).toBe(
      dark.mutedForeground,
    )
    expect(flattenedStyle(getByTestId('font-serif').props.style).backgroundColor).toBe(
      dark.background,
    )
    expect(flattenedTextStyle(getByText('Untitled Serif').props.style).color).toBe(dark.foreground)
    expect(flattenedStyle(getByTestId('font-inter').props.style).backgroundColor).toBe(dark.muted)
  })

  it('follows the provider locale for the font label', () => {
    const { getAllByText, getByTestId, getByText } = render(<SheetHarness isOpen />, {
      wrapper: youVersionProviderWrapper('light', 'es'),
    })

    expect(getAllByText(es.font)).toHaveLength(2)
    expect(getByText('Inter')).toBeTruthy()
    expect(getByText('Untitled Serif')).toBeTruthy()
    expect(getByTestId('font-serif').props.accessibilityLabel).toBe(en.untitledSerifFontName)
  })
})
