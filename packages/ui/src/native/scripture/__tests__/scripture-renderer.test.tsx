import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet, Text } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import { SOURCE_SERIF_FONT } from '../../../lib/reader-fonts'
import { SAMPLE_PASSAGE_HTML } from '../__fixtures__/sample-passage'
import { resolveBodyFontFamily } from '../scripture-fonts'
import { SCRIPTURE_PALETTE } from '../scripture-theme'
import {
  SCRIPT_SCALE,
  SUBSCRIPT_DROP_EM,
  SUPERSCRIPT_RISE_EM,
  Subscript,
  Superscript,
  type ScriptureFootnote,
  renderFootnoteHtml,
  renderScriptureHtml,
} from '../scripture-renderer'

// The footnote marker pulls in react-native-svg; stub it to a plain view that
// forwards onPress + the accessibility label so press/label queries still work.
jest.mock('../scripture-footnote-icon', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return { FootnoteMarkerIcon: (props: object) => <View testID="footnote-icon" {...props} /> }
})

/** Walk up from a node to the nearest ancestor whose style carries a `transform`. */
function transformOf(node: ReactTestInstance | null): unknown {
  for (let cur = node; cur; cur = cur.parent) {
    const flat = StyleSheet.flatten(cur.props.style)
    if (flat.transform != null) return flat.transform
  }
  return undefined
}

describe('Superscript / Subscript', () => {
  it('keeps the real characters, so any numeral system works (i18n-safe)', () => {
    // Devanagari "16" — no Unicode superscript form exists, but the inner Text renders it.
    render(<Superscript fontSize={20}>१६</Superscript>)
    expect(screen.getByText('१६')).toBeTruthy()
  })

  it('shrinks the inner text and raises the wrapping view', () => {
    render(<Superscript fontSize={20}>16</Superscript>)
    const text = screen.getByText('16')
    expect(StyleSheet.flatten(text.props.style).fontSize).toBe(20 * SCRIPT_SCALE)
    expect(transformOf(text)).toEqual([{ translateY: 20 * SUPERSCRIPT_RISE_EM }]) // raised (negative)
  })

  it('lowers the wrapping view for subscript', () => {
    render(<Subscript fontSize={20}>2</Subscript>)
    expect(transformOf(screen.getByText('2'))).toEqual([
      { translateY: 20 * SUBSCRIPT_DROP_EM }, // lowered (positive)
    ])
  })
})

// A `.sup` run mid-verse (e.g. published/alternate verse glyph). It renders through
// the inline `<View>`-wrapped Superscript, which breaks RN text inheritance across
// the view boundary — so the renderer must thread the reader font + themed color in
// explicitly, or the glyph falls back to the system font (dropped baseline) and
// black (invisible in dark mode).
const SUP_HTML =
  '<div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>Text<span class="sup">x</span> more.</div>'

describe('renderScriptureHtml — body super/subscript font + color', () => {
  it('threads the reader body font into an inline superscript (no system-font fallback)', () => {
    render(<>{renderScriptureHtml(SUP_HTML, { theme: 'light' })}</>)
    const sup = screen.getByText('x')
    expect(StyleSheet.flatten(sup.props.style).fontFamily).toBe(
      resolveBodyFontFamily(SOURCE_SERIF_FONT),
    )
  })

  it('colors the superscript with the themed foreground (visible in dark mode)', () => {
    render(<>{renderScriptureHtml(SUP_HTML, { theme: 'dark' })}</>)
    const sup = screen.getByText('x')
    expect(StyleSheet.flatten(sup.props.style).color).toBe(SCRIPTURE_PALETTE.dark.foreground)
  })
})

const FOOTNOTE_HTML =
  '<div class="p"><span class="yv-v" v="2"><span class="yv-vlbl">2 </span>Now the earth was formless<span data-verse-footnote="2" data-verse-footnote-content="&lt;span class=&quot;ft&quot;&gt;Or a wasteland&lt;/span&gt;"></span> and void.</span></div>'

describe('renderScriptureHtml — content', () => {
  it('renders verse text from the raw Acts 15 fixture', () => {
    render(<>{renderScriptureHtml(SAMPLE_PASSAGE_HTML, { theme: 'light' })}</>)
    expect(screen.getByText(/Certain people came down from Judea/)).toBeTruthy()
    expect(screen.getByText(/strengthening the churches/)).toBeTruthy()
  })
})

describe('renderScriptureHtml — verse press', () => {
  it('fires onVersePress with the pressed verse number', () => {
    const onVersePress = jest.fn()
    render(<>{renderScriptureHtml(SAMPLE_PASSAGE_HTML, { theme: 'light', onVersePress })}</>)
    fireEvent.press(screen.getByText(/Certain people came down from Judea/))
    expect(onVersePress).toHaveBeenCalledWith('1')
  })
})

describe('renderScriptureHtml — footnotes (transformed shape)', () => {
  it('surfaces the verse note, lettered, when the marker is pressed', () => {
    const onFootnotePress = jest.fn<void, [ScriptureFootnote]>()
    render(<>{renderScriptureHtml(FOOTNOTE_HTML, { theme: 'light', onFootnotePress })}</>)

    fireEvent.press(screen.getByLabelText('Footnote'))

    expect(onFootnotePress).toHaveBeenCalledTimes(1)
    const footnote = onFootnotePress.mock.calls[0]![0]
    expect(footnote.verseNumber).toBe('2')
    expect(footnote.notes).toHaveLength(1)
    expect(footnote.notes[0]!.letter).toBe('a')
    expect(footnote.notes[0]!.text).toContain('Or a wasteland')
    expect(footnote.notes[0]!.html).toContain('<span class="ft">')
  })

  it('builds the human verse reference from the passage reference', () => {
    const onFootnotePress = jest.fn<void, [ScriptureFootnote]>()
    render(
      <>
        {renderScriptureHtml(FOOTNOTE_HTML, {
          theme: 'light',
          reference: 'Genesis 1',
          usfm: 'GEN.1',
          onFootnotePress,
        })}
      </>,
    )

    fireEvent.press(screen.getByLabelText('Footnote'))
    expect(onFootnotePress.mock.calls[0]![0].reference).toBe('Genesis 1:2')
  })

  it('marks the note position in the verse tokens with the same letter', () => {
    const onFootnotePress = jest.fn<void, [ScriptureFootnote]>()
    render(<>{renderScriptureHtml(FOOTNOTE_HTML, { theme: 'light', onFootnotePress })}</>)

    fireEvent.press(screen.getByLabelText('Footnote'))
    const { verseTokens } = onFootnotePress.mock.calls[0]![0]

    const noteToken = verseTokens.find((t) => t.type === 'note')
    expect(noteToken).toEqual({ type: 'note', letter: 'a' })
    // The note sits between the verse text and the trailing " and void."
    const text = verseTokens
      .map((t) => (t.type === 'text' ? t.text : `[${t.letter}]`))
      .join('')
    expect(text).toBe('Now the earth was formless[a] and void.')
  })
})

// A verse that runs across blocks: v16 starts in a `q1` poetry line and continues
// through `q2`/`q1` lines (no new marker) before v17. The footnote sits in the
// *continuation* block, so per-block grouping would orphan it (no verse/reference)
// and show only that line's text.
const CROSS_BLOCK_HTML =
  '<div>' +
  '<div class="q1"><span class="yv-v" v="16"></span><span class="yv-vlbl">16</span>After this I will return</div>' +
  '<div class="q2">and rebuild David’s fallen tent.<span class="yv-n f"><span class="ft">Or dwelling</span></span></div>' +
  '<div class="q1">Its ruins I will rebuild,</div>' +
  '<div class="q1"><span class="yv-v" v="17"></span><span class="yv-vlbl">17</span>that the rest may seek the Lord,</div>' +
  '</div>'

describe('renderScriptureHtml — verse spanning multiple blocks', () => {
  it('surfaces the whole verse and its reference for a footnote in a continuation block', () => {
    const onFootnotePress = jest.fn<void, [ScriptureFootnote]>()
    render(
      <>
        {renderScriptureHtml(CROSS_BLOCK_HTML, {
          theme: 'light',
          reference: 'Acts 15',
          onFootnotePress,
        })}
      </>,
    )

    fireEvent.press(screen.getByLabelText('Footnote'))
    const footnote = onFootnotePress.mock.calls[0]![0]

    // The marker is in v16's second block, but it resolves to v16 — not orphaned.
    expect(footnote.verseNumber).toBe('16')
    expect(footnote.reference).toBe('Acts 15:16')

    // The drawer shows the whole verse across all three blocks, with the note marked.
    const text = footnote.verseTokens
      .map((t) => (t.type === 'text' ? t.text : `[${t.letter}]`))
      .join('')
    expect(text).toBe('After this I will return and rebuild David’s fallen tent.[a] Its ruins I will rebuild,')
    expect(footnote.notes).toHaveLength(1)
    expect(footnote.notes[0]!.text).toContain('Or dwelling')
  })
})

// Exodus 20:1-2 shape: a `.p` verse, then a `.pi3` verse (indented paragraph the
// style map must recognize), then a `.li1` list-item verse. A `.pi3` with no block
// spec used to be misread as a structural container, stacking its verse marker and
// text as separate vertical blocks instead of one flowing, pressable paragraph.
const INDENTED_PARA_HTML =
  '<div>' +
  '<div class="s1 yv-h">The Ten Commandments</div>' +
  '<div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>And God spoke all these words:</div>' +
  '<div class="pi3"><span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>“I am the <span class="nd">Lord</span> your God, who brought you out of Egypt.</div>' +
  '<div class="li1"><span class="yv-v" v="3"></span><span class="yv-vlbl">3</span>“You shall have no other gods before me.</div>' +
  '</div>'

describe('renderScriptureHtml — indented paragraph (pi3) verses', () => {
  it('renders a pi3 verse as one flowing, pressable paragraph (not stacked blocks)', () => {
    const onVersePress = jest.fn()
    render(<>{renderScriptureHtml(INDENTED_PARA_HTML, { theme: 'light', onVersePress })}</>)

    // The whole verse renders as a single run (divine name inline, not split out).
    const verseTwo = screen.getByText(/I am the.*your God, who brought you out of Egypt/)
    expect(verseTwo).toBeTruthy()

    // It is a real verse paragraph, so pressing it reports verse 2 — proof it went
    // through verse grouping rather than the container path (which wires no press).
    fireEvent.press(verseTwo)
    expect(onVersePress).toHaveBeenCalledWith('2')
  })
})

const LIST_ITEM_HTML =
  '<div><div class="li1"><span class="yv-v" v="3"></span><span class="yv-vlbl">3</span>“You shall have no other gods before me.</div></div>'

describe('renderScriptureHtml — list items', () => {
  it('renders a list-item verse as one flowing, pressable paragraph', () => {
    const onVersePress = jest.fn()
    render(<>{renderScriptureHtml(LIST_ITEM_HTML, { theme: 'light', onVersePress })}</>)

    // List items render via the normal paragraph path with a block indent (RN cannot
    // reproduce the CSS hanging indent — see ADR 0010), so the body is one Text run.
    fireEvent.press(screen.getByText(/You shall have no other gods before me/))
    expect(onVersePress).toHaveBeenCalledWith('3')
  })
})

const HANG_Q1_HTML =
  '<div class="q1"><span class="yv-v" v="5"></span><span class="yv-vlbl">5 </span>The Lord is my shepherd, I shall not want.</div>'
const HANG_Q1_FOOTNOTE_HTML =
  '<div class="q1"><span class="yv-v" v="5"></span><span class="yv-vlbl">5 </span>The Lord is my shepherd<span class="yv-n f"><span class="ft">Or my keeper</span></span>.</div>'

describe('renderScriptureHtml — native hanging paragraph (injected)', () => {
  it('routes a poetry block through the native renderer with serialized runs + geometry', () => {
    const onVersePress = jest.fn()
    type HangProps = { runs: { text: string; baselineShiftEm?: number }[]; firstIndent: number; restIndent: number; onVersePress?: () => void }
    const calls: HangProps[] = []
    const Hanging = (props: HangProps) => {
      calls.push(props)
      return <Text>{props.runs.map((r) => r.text).join('')}</Text>
    }

    render(
      <>
        {renderScriptureHtml(HANG_Q1_HTML, {
          theme: 'light',
          fontSize: 20,
          renderHangingParagraph: Hanging,
          onVersePress,
        })}
      </>,
    )

    expect(calls).toHaveLength(1)
    const props = calls[0]!
    // q1 hang [first 0, wrapped 2] em at fontSize 20 → 0 / 40 px.
    expect(props.firstIndent).toBe(0)
    expect(props.restIndent).toBe(40)
    // First run is the verse number, baseline-raised; verse text follows.
    expect(props.runs[0]!.text).toBe('5')
    expect(props.runs[0]!.baselineShiftEm).toBeGreaterThan(0)
    expect(props.runs.map((r) => r.text).join('')).toContain('The Lord is my shepherd')
    // Whole-paragraph verse press maps back to the verse number.
    props.onVersePress?.()
    expect(onVersePress).toHaveBeenCalledWith('5')
  })

  it('renders a footnote-bearing block natively (a bubble marker run + tap payload)', () => {
    const onFootnotePress = jest.fn()
    type Run = { text: string; footnote?: boolean; footnoteIndex?: number }
    type HangProps = { runs: Run[]; onFootnotePress?: (i: number) => void }
    const calls: HangProps[] = []
    const Hanging = (props: HangProps) => {
      calls.push(props)
      return <Text>{props.runs.map((r) => r.text).join('')}</Text>
    }

    render(
      <>
        {renderScriptureHtml(HANG_Q1_FOOTNOTE_HTML, {
          theme: 'light',
          renderHangingParagraph: Hanging,
          onFootnotePress,
        })}
      </>,
    )

    // No bail — the footnoted block hangs natively. The marker is an empty `footnote`
    // run (native draws the bubble icon) carrying its index.
    expect(calls).toHaveLength(1)
    const marker = calls[0]!.runs.find((r) => r.footnote)
    expect(marker).toBeDefined()
    expect(marker!.footnoteIndex).toBe(0)
    // Tapping the bubble surfaces the footnote payload to the drawer.
    calls[0]!.onFootnotePress?.(0)
    expect(onFootnotePress).toHaveBeenCalledTimes(1)
    expect(onFootnotePress.mock.calls[0]![0].notes[0].text).toContain('Or my keeper')
  })
})

const RAW_FOOTNOTE_HTML =
  '<div class="p"><span class="yv-v" v="3"></span><span class="yv-vlbl">3</span>Text<span class="yv-n f"><span class="fr">3:1 </span><span class="ft">Or otherwise</span></span> more.</div>'

describe('renderScriptureHtml — footnotes (raw .yv-n shape)', () => {
  it('surfaces the raw footnote inner HTML as the note content', () => {
    const onFootnotePress = jest.fn<void, [ScriptureFootnote]>()
    render(<>{renderScriptureHtml(RAW_FOOTNOTE_HTML, { theme: 'light', onFootnotePress })}</>)

    fireEvent.press(screen.getByLabelText('Footnote'))

    const note = onFootnotePress.mock.calls[0]![0].notes[0]!
    expect(note.html).toContain('<span class="fr">3:1 </span>')
    expect(note.html).toContain('<span class="ft">Or otherwise</span>')
  })
})

describe('renderFootnoteHtml', () => {
  it('renders USFM footnote character styles (fr reference + ft text) as inline runs', () => {
    const inner = '<span class="fr">3:1 </span><span class="ft">Or otherwise</span>'
    render(<Text>{renderFootnoteHtml(inner, { theme: 'light' })}</Text>)

    expect(screen.getByText(/3:1/)).toBeTruthy()
    expect(screen.getByText(/Or otherwise/)).toBeTruthy()
  })

  it('applies the bold footnote-reference (fr) style', () => {
    render(<Text>{renderFootnoteHtml('<span class="fr">3:1</span>', { theme: 'light' })}</Text>)

    const ref = screen.getByText('3:1')
    expect(StyleSheet.flatten(ref.props.style).fontWeight).toBe('bold')
  })
})
