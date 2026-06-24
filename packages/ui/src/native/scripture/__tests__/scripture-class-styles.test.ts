import { SOURCE_SERIF_FONT } from '../../../lib/reader-fonts'
import type { Theme } from '../../../lib/resolve-theme'
import {
  type ScriptureStyleContext,
  getBlockSpec,
  resolveBlockTextStyle,
  resolveInlineTextStyle,
} from '../scripture-class-styles'
import { SCRIPTURE_PALETTE } from '../scripture-theme'

const ctx = (theme: Theme = 'light'): ScriptureStyleContext => ({
  baseFontSize: 20,
  lineHeightMultiplier: 1.625,
  fontFamily: SOURCE_SERIF_FONT,
  palette: SCRIPTURE_PALETTE[theme],
})

describe('resolveBlockTextStyle', () => {
  it('sizes a normal paragraph at the base font size', () => {
    const style = resolveBlockTextStyle(['p'], ctx())
    expect(style.fontSize).toBe(20)
    expect(style.color).toBe(SCRIPTURE_PALETTE.light.foreground)
  })

  it('scales major titles by their em factor and bolds them', () => {
    const style = resolveBlockTextStyle(['mt1'], ctx())
    expect(style.fontSize).toBeCloseTo(32) // 1.6 * 20
    expect(style.fontWeight).toBe('bold')
  })

  it('staircases poetry indent by level (q1 flush, deeper levels indent more)', () => {
    expect(resolveBlockTextStyle(['q1'], ctx()).paddingLeft).toBeUndefined() // net 0
    expect(resolveBlockTextStyle(['q2'], ctx()).paddingLeft).toBe(20) // 1em
    expect(resolveBlockTextStyle(['q4'], ctx()).paddingLeft).toBe(40) // 2em
  })

  it('block-indents list items at the SDK padding (the CSS hanging indent is not reachable in RN)', () => {
    // Matches the SDK `.li1` `padding-inline-start: 2em`; the first line indents with
    // the rest since RN cannot reproduce the `text-indent: -1.5em` hang (see ADR 0010).
    expect(resolveBlockTextStyle(['li1'], ctx()).paddingLeft).toBe(40) // 2em
    expect(resolveBlockTextStyle(['li2'], ctx()).paddingLeft).toBe(60) // 3em
  })

  it('gives prose paragraphs a first-line indent but not embedded/poetry blocks', () => {
    expect(getBlockSpec(['p'])?.firstLineIndentEm).toBe(1)
    expect(getBlockSpec(['pmo'])?.firstLineIndentEm).toBeUndefined()
    expect(getBlockSpec(['q1'])?.firstLineIndentEm).toBeUndefined()
  })

  it('bolds section headings and italicizes descriptive titles', () => {
    expect(resolveBlockTextStyle(['s1'], ctx()).fontWeight).toBe('bold')
    expect(resolveBlockTextStyle(['d'], ctx()).fontStyle).toBe('italic')
  })

  it('centers and right-aligns the matching paragraph classes', () => {
    expect(resolveBlockTextStyle(['pc'], ctx()).textAlign).toBe('center')
    expect(resolveBlockTextStyle(['pr'], ctx()).textAlign).toBe('right')
  })

  it('resolves foreground per theme', () => {
    expect(resolveBlockTextStyle(['p'], ctx('light')).color).toBe('#121212')
    expect(resolveBlockTextStyle(['p'], ctx('dark')).color).toBe('#ffffff')
  })

  it('falls back to a plain body paragraph for unknown/bare blocks', () => {
    const style = resolveBlockTextStyle([], ctx())
    expect(style.fontSize).toBe(20)
    expect(style.fontWeight).toBeUndefined()
  })
})

describe('resolveInlineTextStyle', () => {
  it('colors words of Jesus with the themed red', () => {
    expect(resolveInlineTextStyle(['wj'], ctx('light'), 20).color).toBe('#ff3d4d')
    expect(resolveInlineTextStyle(['wj'], ctx('dark'), 20).color).toBe('#f04c59')
  })

  it('italicizes translator additions and emphasis', () => {
    expect(resolveInlineTextStyle(['add'], ctx(), 20).fontStyle).toBe('italic')
    expect(resolveInlineTextStyle(['it'], ctx(), 20).fontStyle).toBe('italic')
  })

  it('applies small-caps for name-of-deity', () => {
    expect(resolveInlineTextStyle(['nd'], ctx(), 20).fontVariant).toEqual(['small-caps'])
  })

  it('composes multiple character styles (bold + italic)', () => {
    const style = resolveInlineTextStyle(['bdit'], ctx(), 20)
    expect(style.fontWeight).toBe('bold')
    expect(style.fontStyle).toBe('italic')
  })

  it('cascades font size from the parent run', () => {
    expect(resolveInlineTextStyle(['wj'], ctx(), 32).fontSize).toBe(32)
  })
})
