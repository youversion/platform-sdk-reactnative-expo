import { render, screen } from '@testing-library/react-native'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { StyleSheet } from 'react-native'

import { mockWindowDimensions } from '../../../jest.window-dimensions-mock'
import { READER_LINE_SPACING } from '../../stores/types/reader-line-spacing'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../theme'
import { fontMapKey, SERIF_STANDIN } from '../../theme/fonts'
import { SerifFamilyProvider } from '../../theme/use-fonts'
import FootnoteContent from '../footnote-content'
import { lineMultiple } from '../scripture/styles'

const light = getTokens('light')
const dark = getTokens('dark')
const DEFAULT_LINE_HEIGHT = 16 * lineMultiple(READER_LINE_SPACING.DEFAULT)

const johnNote: FootnoteData = {
  verseNum: '5',
  reference: 'John 1',
  verseHtml:
    'He then added, <span class="wj">"Very truly I tell you,"</span><sup class="yv:text-muted-foreground">a</sup>',
  notes: [
    '<span class="fr">1:5 </span><span class="ft">Or </span><span class="fqa">understood</span>',
    '<span class="ft">First paragraph.</span><span class="fp"><span class="fk">Keyword</span></span>',
  ],
}

function flattened(text: string) {
  return StyleSheet.flatten(screen.getByText(text).props.style)
}

describe('FootnoteContent', () => {
  it('renders the verse and notes in serif with the scripture character styles, as Swift does', () => {
    render(<FootnoteContent {...sheetProps(johnNote)} versionAbbreviation="NIV" />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(flattened('John 1:5 NIV')).toMatchObject({
      color: light.foreground,
      fontFamily: fontMapKey(light.fontFamily.sans, 700, 'normal'),
      fontSize: light.typography.base.fontSize,
    })
    expect(screen.getByText('John 1:5 NIV').props.allowFontScaling).toBe(false)
    expect(flattened('He then added, ')).toMatchObject({
      color: light.foreground,
      fontFamily: fontMapKey(light.fontFamily.serif, 400, 'normal'),
      fontSize: 16,
      lineHeight: DEFAULT_LINE_HEIGHT,
    })
    // Swift's sheet paints words of Jesus in the text color.
    expect(flattened('"Very truly I tell you,"')).toMatchObject({ color: light.foreground })
    const marker = screen.getByText('a')
    expect(marker.props.allowFontScaling).toBe(false)
    expect(StyleSheet.flatten(marker.props.style)).toMatchObject({
      color: light.mutedForeground,
      fontSize: 10,
      lineHeight: 10,
    })
    expect(
      StyleSheet.flatten(screen.getByTestId('footnote-superscript').props.style),
    ).toMatchObject({ transform: [{ translateY: -5 }] })

    expect(flattened('1:5')).toMatchObject({
      fontFamily: fontMapKey(light.fontFamily.serif, 700, 'normal'),
      fontSize: 16,
    })
    expect(flattened('Or')).toMatchObject({
      color: light.foreground,
      fontFamily: fontMapKey(light.fontFamily.serif, 400, 'normal'),
      fontSize: 16,
      lineHeight: DEFAULT_LINE_HEIGHT,
    })
    expect(flattened('understood')).toMatchObject({
      fontFamily: fontMapKey(light.fontFamily.serif, 400, 'italic'),
      fontSize: 16,
    })
    expect(flattened('a.')).toMatchObject({
      fontFamily: fontMapKey(light.fontFamily.sans, 500, 'normal'),
      fontSize: 11,
    })
    expect(flattened('b.')).toBeTruthy()
    expect(flattened('First paragraph.')).toMatchObject({
      fontFamily: fontMapKey(light.fontFamily.serif, 400, 'normal'),
    })
    expect(flattened('Keyword')).toMatchObject({
      fontFamily: fontMapKey(light.fontFamily.serif, 500, 'italic'),
    })
  })

  it('takes its line height from the reader line spacing', () => {
    render(<FootnoteContent {...sheetProps(johnNote)} lineSpacing={READER_LINE_SPACING.LG} />, {
      wrapper: youVersionProviderWrapper(),
    })

    const lineHeight = 16 * lineMultiple(READER_LINE_SPACING.LG)
    expect(flattened('He then added, ')).toMatchObject({ lineHeight })
    expect(flattened('Or')).toMatchObject({ lineHeight })
    expect(flattened('a.')).toMatchObject({ lineHeight })
  })

  it('omits the version from the heading when the host has none', () => {
    render(<FootnoteContent {...sheetProps(johnNote)} />, { wrapper: youVersionProviderWrapper() })

    expect(screen.getByText('John 1:5')).toBeTruthy()
  })

  it('paints the verse with the dark token when the sheet theme is dark', () => {
    render(<FootnoteContent {...sheetProps(johnNote)} theme="dark" />, {
      wrapper: youVersionProviderWrapper('light'),
    })

    expect(flattened('He then added, ')).toMatchObject({ color: dark.foreground })
    expect(flattened('John 1:5')).toMatchObject({ color: dark.foreground })
    expect(flattened('Or')).toMatchObject({ color: dark.foreground })
  })

  it('lays the sheet out right to left for rtl scripture', () => {
    render(<FootnoteContent {...sheetProps(johnNote)} scriptureDirection="rtl" />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(StyleSheet.flatten(screen.getByTestId('footnote-content').props.style)).toMatchObject({
      direction: 'rtl',
    })
  })

  it('caps the body below the screen so a long note can scroll', () => {
    render(<FootnoteContent {...sheetProps(johnNote)} />, { wrapper: youVersionProviderWrapper() })

    const { maxHeight } = StyleSheet.flatten(screen.getByTestId('footnote-content').props.style)
    expect(maxHeight).toBeGreaterThan(0)
    expect(maxHeight).toBeLessThan(mockWindowDimensions.height)
  })

  it('names the Source Serif 4 fallback when Untitled Serif did not register', () => {
    render(
      <SerifFamilyProvider family="Source Serif 4">
        <FootnoteContent {...sheetProps(johnNote)} />
      </SerifFamilyProvider>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(flattened('He then added, ')).toMatchObject({
      fontFamily: fontMapKey('Source Serif 4', 400, 'normal'),
    })
  })

  it('uses the system serif stand-in until the serif load settles', () => {
    render(
      <SerifFamilyProvider family={light.fontFamily.serif} ready={false}>
        <FootnoteContent {...sheetProps(johnNote)} />
      </SerifFamilyProvider>,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(flattened('He then added, ')).toMatchObject({
      fontFamily: SERIF_STANDIN,
    })
  })

  it('hides the verse block when the note has no verse html', () => {
    render(
      <FootnoteContent
        {...sheetProps({
          verseNum: 'intro-0',
          notes: ['<span class="ft">Only note</span>'],
          verseHtml: '',
        })}
      />,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(screen.queryByTestId('footnote-reference')).toBeNull()
    expect(screen.queryByText('intro-0')).toBeNull()
    expect(screen.getByText('Only note')).toBeTruthy()
    expect(screen.getByText('a.')).toBeTruthy()
  })

  it('sizes the verse and notes from the configured font size', () => {
    render(<FootnoteContent {...sheetProps(johnNote)} fontSize={20} />, {
      wrapper: youVersionProviderWrapper(),
    })

    const lineHeight = 20 * lineMultiple(READER_LINE_SPACING.DEFAULT)
    expect(flattened('He then added, ')).toMatchObject({ fontSize: 20, lineHeight })
    expect(flattened('Or')).toMatchObject({ fontSize: 20, lineHeight })
  })
})

function sheetProps(data: FootnoteData) {
  return { data }
}
