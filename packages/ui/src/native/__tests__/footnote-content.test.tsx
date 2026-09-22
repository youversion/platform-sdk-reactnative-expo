import { render, screen } from '@testing-library/react-native'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { StyleSheet } from 'react-native'

import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { getTokens } from '../../theme'
import { fontMapKey } from '../../theme/fonts'
import FootnoteContent from '../footnote-content'

const light = getTokens('light')
const dark = getTokens('dark')

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
  it('shows the reference, verse, raised marker, and a plain note', () => {
    render(<FootnoteContent {...sheetProps(johnNote)} fontSize={22} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(flattened('John 1:5')).toMatchObject({
      color: light.foreground,
      fontFamily: fontMapKey(light.fontFamily.sans, 700, 'normal'),
      fontSize: light.typography.base.fontSize,
    })
    expect(screen.getByText('John 1:5').props.allowFontScaling).toBe(false)
    expect(screen.getByText('He then added, "Very truly I tell you,"').props.allowFontScaling).toBe(
      false,
    )
    expect(screen.getByText('1:5 Or understood').props.allowFontScaling).toBe(false)
    expect(screen.getByText('a').props.allowFontScaling).toBe(false)
    expect(flattened('He then added, "Very truly I tell you,"')).toMatchObject({
      color: light.foreground,
      fontFamily: fontMapKey(light.fontFamily.serif, 400, 'normal'),
      fontSize: 22,
      lineHeight: 33,
    })
    const marker = screen.getByText('a')
    expect(StyleSheet.flatten(marker.props.style)).toMatchObject({
      color: light.mutedForeground,
      fontSize: 17,
      lineHeight: 17,
    })
    expect(StyleSheet.flatten(screen.getByTestId('footnote-superscript').props.style)).toMatchObject({
      transform: [{ translateY: -9 }],
    })
    expect(flattened('1:5 Or understood')).toMatchObject({
      color: light.foreground,
      fontFamily: fontMapKey(light.fontFamily.sans, 400, 'normal'),
      fontSize: 12,
      lineHeight: 16,
    })
    expect(flattened('a.')).toMatchObject({
      color: light.foreground,
      fontFamily: fontMapKey(light.fontFamily.sans, 400, 'normal'),
      fontSize: 12,
      lineHeight: 16,
    })
    expect(flattened('b.')).toBeTruthy()
    expect(flattened('First paragraph.Keyword')).toMatchObject({
      fontFamily: fontMapKey(light.fontFamily.sans, 400, 'normal'),
      fontSize: 12,
      lineHeight: 16,
    })
  })

  it('uses a 20px verse face when the host does not pass fontSize', () => {
    render(
      <FootnoteContent
        {...sheetProps({
          verseNum: '3',
          notes: [],
          verseHtml: '<p>footnote</p>',
        })}
      />,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(flattened('footnote')).toMatchObject({
      fontFamily: fontMapKey(light.fontFamily.serif, 400, 'normal'),
      fontSize: 20,
      lineHeight: 30,
      color: light.foreground,
    })
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.queryByTestId('footnote-note-a')).toBeNull()
  })

  it('paints the verse with the dark token when the sheet theme is dark', () => {
    render(<FootnoteContent {...sheetProps(johnNote)} theme="dark" />, {
      wrapper: youVersionProviderWrapper('light'),
    })

    expect(flattened('He then added, "Very truly I tell you,"')).toMatchObject({
      color: dark.foreground,
    })
    expect(flattened('John 1:5')).toMatchObject({ color: dark.foreground })
    expect(flattened('1:5 Or understood')).toMatchObject({ color: dark.foreground })
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
})

function sheetProps(data: FootnoteData) {
  return {
    data,
    appKey: 'test-key',
    apiHost: 'api.youversion.com',
    installationId: 'install',
    locale: 'en',
  }
}
