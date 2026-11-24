/**
 * Layer 3 — verse indicators: a verse number drawn as a marker with its own tap.
 * The plain path (no indicators) must render exactly as before.
 */
import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import { LocaleProvider } from '../../../i18n/locale-context'
import type { VerseIndicatorStyle } from '../../../types/verse-hook-types'
import type { HighlightPaint } from '../highlight-colors'
import { parsePassage } from '../parse-passage'
import { Passage, type PassageLook } from '../passage'

const LOOK: PassageLook = {
  fontSize: 20,
  lineMultiple: 1.64,
  rtl: false,
  face: () => ({}),
  labelFace: {},
  ink: '#000000',
  label: '#636161',
  wj: '#ff0000',
  underline: '#cccccc',
  background: '#ffffff',
}

const NBSP = ' '
const MARKER: VerseIndicatorStyle = { backgroundColor: '#3366ff', foregroundColor: '#ffffff' }

const HTML =
  '<div><div class="p"><span class="yv-v" v="7"></span><span class="yv-vlbl">7</span>his god. ' +
  '<span class="yv-v" v="8"></span><span class="yv-vlbl">8</span>Cyrus king' +
  '<span class="yv-n f"><span class="ft">Or Koresh</span></span></div></div>'

type Options = {
  indicators?: ReadonlyMap<number, VerseIndicatorStyle>
  onIndicatorPress?: (verse: number) => void
  onVersePress?: (verse: number) => void
  onNotePress?: (verse: number | null, html: string) => void
  selected?: ReadonlySet<number>
  paint?: ReadonlyMap<number, HighlightPaint>
}

function renderPassage(options: Options = {}) {
  const props = {
    blocks: parsePassage(HTML).blocks,
    look: LOOK,
    selected: options.selected ?? new Set<number>(),
    paint: options.paint ?? new Map<number, HighlightPaint>(),
    focus: null,
    onVersePress: options.onVersePress ?? jest.fn(),
    onNotePress: options.onNotePress ?? jest.fn(),
    indicators: options.indicators,
    onIndicatorPress: options.onIndicatorPress,
  }
  const view = render(
    <LocaleProvider locale="en">
      <Passage {...props} />
    </LocaleProvider>,
  )
  return { ...view, props }
}

function style(node: ReactTestInstance) {
  return StyleSheet.flatten(node.props.style)
}

/** Every text node whose own text is exactly `text`, across all layers. */
function textNodes(text: string): ReactTestInstance[] {
  return screen.root.findAll((node) => node.type === Text && node.props.children === text)
}

describe('verse indicators', () => {
  it('leaves the plain path without markers or buttons', () => {
    renderPassage()

    expect(screen.queryByTestId(/^verse-indicator-/)).toBeNull()
    expect(screen.queryAllByRole('button').map((node) => node.props.accessibilityLabel)).toEqual([
      'Footnote',
    ])
  })

  it('draws the marker only on verses the map names', () => {
    renderPassage({ indicators: new Map([[8, MARKER]]), onIndicatorPress: jest.fn() })

    expect(screen.getByTestId('verse-indicator-8')).toBeTruthy()
    expect(screen.queryByTestId('verse-indicator-7')).toBeNull()
    const [label] = textNodes('8')
    expect(style(label!).backgroundColor).toBe('#3366ff')
    expect(style(label!).color).toBe('#ffffff')
  })

  it('sends a marker tap to onIndicatorPress, never onVersePress', () => {
    const onIndicatorPress = jest.fn()
    const onVersePress = jest.fn()
    renderPassage({ indicators: new Map([[8, MARKER]]), onIndicatorPress, onVersePress })

    fireEvent.press(screen.getByTestId('verse-indicator-8'))

    expect(onIndicatorPress).toHaveBeenCalledWith(8)
    expect(onVersePress).not.toHaveBeenCalled()
  })

  it('still selects the verse from its words', () => {
    const onIndicatorPress = jest.fn()
    const onVersePress = jest.fn()
    renderPassage({ indicators: new Map([[8, MARKER]]), onIndicatorPress, onVersePress })

    fireEvent.press(screen.getByText('Cyrus king'))

    expect(onVersePress).toHaveBeenCalledWith(8)
    expect(onIndicatorPress).not.toHaveBeenCalled()
  })

  it('keeps footnote taps working beside a marker', () => {
    const onNotePress = jest.fn()
    const onIndicatorPress = jest.fn()
    renderPassage({ indicators: new Map([[8, MARKER]]), onIndicatorPress, onNotePress })

    fireEvent.press(screen.getByLabelText('Footnote'))

    expect(onNotePress).toHaveBeenCalledWith(8, expect.stringContaining('Or Koresh'))
    expect(onIndicatorPress).not.toHaveBeenCalled()
  })

  it('falls back to the verse tap when the host gives no indicator handler', () => {
    const onVersePress = jest.fn()
    renderPassage({ indicators: new Map([[8, MARKER]]), onVersePress })

    fireEvent.press(textNodes('8')[0]!)

    expect(onVersePress).toHaveBeenCalledWith(8)
  })

  it('labels the marker with the verse number, or the host label', () => {
    renderPassage({
      indicators: new Map([
        [7, MARKER],
        [8, { ...MARKER, accessibilityLabel: 'Note on verse 8' }],
      ]),
      onIndicatorPress: jest.fn(),
    })

    expect(screen.getByTestId('verse-indicator-7').props.accessibilityLabel).toBe('7')
    expect(screen.getByTestId('verse-indicator-7').props.accessibilityRole).toBe('button')
    expect(screen.getByTestId('verse-indicator-8').props.accessibilityLabel).toBe(
      'Note on verse 8',
    )
  })

  it('grows the tap target to the minimum hit size without growing the marker', () => {
    renderPassage({
      indicators: new Map([[8, { ...MARKER, minimumHitSize: 48 }]]),
      onIndicatorPress: jest.fn(),
    })

    expect(screen.getByTestId('verse-indicator-hit-8').props.style).toEqual(
      expect.objectContaining({ position: 'absolute', width: 48, height: 48, marginLeft: -24 }),
    )
  })

  it('opens the marker from a tap on its overhang', () => {
    const onIndicatorPress = jest.fn()
    const onVersePress = jest.fn()
    renderPassage({ indicators: new Map([[8, MARKER]]), onIndicatorPress, onVersePress })

    fireEvent.press(screen.getByTestId('verse-indicator-hit-8'))

    expect(onIndicatorPress).toHaveBeenCalledWith(8)
    expect(onVersePress).not.toHaveBeenCalled()
  })

  it('pads the number in every layer so the underline ghost lays out like the text', () => {
    renderPassage({
      indicators: new Map([[8, { ...MARKER, inlinePadding: true }]]),
      onIndicatorPress: jest.fn(),
      selected: new Set([8]),
    })
    // The underline ghost draws one strip per measured line.
    const [real] = screen.root.findAll((node) => node.props.onTextLayout !== undefined)
    const line = { text: 'x', x: 0, y: 0, width: 200, height: 30, descender: 8, capHeight: 12, ascender: 21, xHeight: 8 }
    fireEvent(real!, 'textLayout', { nativeEvent: { lines: [line] } })

    const padded = textNodes(`${NBSP}8${NBSP}`)
    // The text layer and the selection underline ghost.
    expect(padded).toHaveLength(2)
    expect(textNodes('8')).toHaveLength(0)
    // Only the real text paints the marker.
    expect(padded.map((node) => style(node).backgroundColor ?? null)).toEqual(['#3366ff', null])
  })

  it('draws the marker over a highlight', () => {
    renderPassage({
      indicators: new Map([[8, { backgroundColor: '#3366ff' }]]),
      onIndicatorPress: jest.fn(),
      paint: new Map([[8, { background: '#ffec5b', text: '#ffffff' }]]),
    })

    const [label] = textNodes('8')
    expect(style(label!).backgroundColor).toBe('#3366ff')
    // No host foreground: the highlight's ink, so a dark swatch keeps a light number.
    expect(style(label!).color).toBe('#ffffff')
  })

  it('repaints a block when only the marker style changes', () => {
    const { rerender, props } = renderPassage({
      indicators: new Map([[8, MARKER]]),
      onIndicatorPress: jest.fn(),
    })

    rerender(
      <LocaleProvider locale="en">
        <Passage {...props} indicators={new Map([[8, { ...MARKER, backgroundColor: '#00aa00' }]])} />
      </LocaleProvider>,
    )

    expect(style(textNodes('8')[0]!).backgroundColor).toBe('#00aa00')
  })
})
