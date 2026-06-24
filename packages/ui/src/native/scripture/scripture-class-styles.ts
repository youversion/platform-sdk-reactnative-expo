import type { TextStyle } from 'react-native'

import type { FontFamily } from '../../lib/reader-fonts'
import { resolveBodyFontFamily } from './scripture-fonts'
import type { ScripturePalette } from './scripture-theme'

/**
 * Curated USFM class → React Native style map, translated verbatim from the Web
 * SDK's `@youversion/platform-core/src/styles/bible-reader.css`. Em-based values
 * from the CSS are kept as multipliers and resolved against the reader's base
 * font size at render time so font-size changes cascade like the web reader.
 *
 * Two maps mirror the CSS's block vs. character-style split:
 * - `BLOCK_STYLES` — paragraph/heading/poetry/list classes (CSS `display: block`).
 * - `INLINE_STYLES` — character styles applied to runs of text (`.wj`, `.it`, …).
 *
 * RN fidelity gaps (documented): no `text-indent` (poetry/list hanging indents
 * approximated with `paddingLeft`; `.p` first-line indent dropped) and no inline
 * `vertical-align` (verse numbers can't be raised).
 */

export type BlockStyleSpec = {
  fontSizeEm?: number
  /** Line-height multiplier for this block (defaults to the body multiplier). */
  lineHeightEm?: number
  marginTopEm?: number
  marginBottomEm?: number
  bold?: boolean
  italic?: boolean
  align?: 'center' | 'right'
  /**
   * Left indent applied to every line (CSS `padding-inline-start` net of any
   * `text-indent`). For poetry this is the net first-line position, since RN
   * cannot hang-indent wrapped lines.
   */
  paddingLeftEm?: number
  /**
   * First-line-only indent (CSS `text-indent` > 0). Emulated by the renderer
   * with a leading em-space, since RN `<Text>` has no `text-indent`.
   */
  firstLineIndentEm?: number
  /**
   * Hanging indent `[firstLineEm, wrappedLineEm]` from the CSS `padding-inline-start`
   * (wrapped) + negative `text-indent` (first). Consumed **only** by the injected
   * native hanging-paragraph renderer (ADR 0011), which can apply a true hang via
   * platform paragraph styles. With no native renderer, the uniform `paddingLeftEm`
   * approximation is used instead.
   */
  hangIndentEm?: [first: number, wrapped: number]
}

export type InlineStyleSpec = {
  color?: 'red' | 'muted'
  bold?: boolean
  italic?: boolean
  fontSizeEm?: number
  smallCaps?: boolean
}

/** Poetry margin-bottom is `calc(var(--yv-reader-font-size) * 0.3)` in the CSS. */
const POETRY_MB = 0.3
/** Most paragraph variants use `* 0.5`. */
const PARA_MB = 0.5

export const BLOCK_STYLES: Record<string, BlockStyleSpec> = {
  // Titles
  mt: { fontSizeEm: 1.6, bold: true, lineHeightEm: 1.4, marginTopEm: 1, marginBottomEm: 0.25 },
  mt1: { fontSizeEm: 1.6, bold: true, lineHeightEm: 1.4, marginTopEm: 1, marginBottomEm: 0.25 },
  mt2: { fontSizeEm: 1.3, italic: true, lineHeightEm: 1.4, marginTopEm: 0.5, marginBottomEm: 0.15 },
  mt3: { fontSizeEm: 1.3, bold: true, lineHeightEm: 1.4, marginTopEm: 0.15, marginBottomEm: 0.15 },
  mt4: { lineHeightEm: 1.8, marginTopEm: 0.15, marginBottomEm: 0.15 },

  // Major section headings
  ms: { fontSizeEm: 1.17, bold: true, lineHeightEm: 1.8, marginTopEm: 1, marginBottomEm: 0.25 },
  ms1: { fontSizeEm: 1.17, bold: true, lineHeightEm: 1.8, marginTopEm: 1, marginBottomEm: 0.25 },
  ms2: { fontSizeEm: 1.17, bold: true, lineHeightEm: 1.8, marginTopEm: 0.5, marginBottomEm: 0.5 },
  ms3: { fontSizeEm: 1.17, italic: true, lineHeightEm: 1.8, marginTopEm: 0.5, marginBottomEm: 0.5 },
  mr: { italic: true, lineHeightEm: 1.8, marginBottomEm: 0.5 },

  // Section headings
  s: { bold: true, lineHeightEm: 1.8, marginTopEm: 0.5, marginBottomEm: 0.5 },
  s1: { bold: true, lineHeightEm: 1.8, marginTopEm: 0.5, marginBottomEm: 0.5 },
  s2: { italic: true, lineHeightEm: 1.8, marginTopEm: 0.5, marginBottomEm: 0.5 },
  s3: { italic: true, lineHeightEm: 1.8, marginTopEm: 0.5, marginBottomEm: 0.25 },
  s4: { italic: true, lineHeightEm: 1.8, marginTopEm: 0.5, marginBottomEm: 0.25 },
  sr: { bold: true, lineHeightEm: 1.8, marginBottomEm: 0.5 },
  r: { italic: true, lineHeightEm: 1.8, marginBottomEm: 0.5 },
  sp: { italic: true, lineHeightEm: 1.8, marginBottomEm: 0.5 },
  d: { italic: true, lineHeightEm: 1.8, marginTopEm: 0.5, marginBottomEm: 0.5 },
  qa: { italic: true, lineHeightEm: 1.8, marginBottomEm: 0.5 },
  heading: { bold: true, lineHeightEm: 1.8, marginTopEm: 0.5, marginBottomEm: 0.5 },

  // Paragraphs (CSS `.p`/`.pi` first-line `text-indent: 1em`; embedded `pm*`/`mi`
  // are block-indented `padding-inline-start: 2em` with no first-line indent)
  p: { marginBottomEm: 0, firstLineIndentEm: 1 },
  m: { marginBottomEm: PARA_MB },
  nb: { marginBottomEm: PARA_MB },
  pi: { marginBottomEm: PARA_MB, firstLineIndentEm: 1 },
  pi1: { marginBottomEm: PARA_MB, firstLineIndentEm: 1 },
  // CSS `.pi2`: text-indent 2em + padding-inline-start 1em; `.pi3`: 4em + 3em. The
  // block padding is the wrapped-line position; the first-line indent stacks on top.
  pi2: { marginBottomEm: PARA_MB, paddingLeftEm: 1, firstLineIndentEm: 2 },
  pi3: { marginBottomEm: PARA_MB, paddingLeftEm: 3, firstLineIndentEm: 4 },
  pc: { align: 'center', marginBottomEm: PARA_MB },
  pr: { align: 'right', marginBottomEm: PARA_MB },
  po: { marginBottomEm: PARA_MB, firstLineIndentEm: 1 },
  mi: { paddingLeftEm: 2, marginBottomEm: PARA_MB },
  pm: { paddingLeftEm: 2, marginBottomEm: PARA_MB },
  pmo: { paddingLeftEm: 2, marginBottomEm: PARA_MB },
  pmc: { paddingLeftEm: 2, marginBottomEm: PARA_MB },
  pmr: { paddingLeftEm: 2, marginBottomEm: PARA_MB },
  cls: { align: 'right', marginTopEm: 0.5, marginBottomEm: 0.5 },

  // Poetry — hangIndentEm [first, wrapped] from the CSS (padding-inline-start +
  // negative text-indent); used by the native hanging renderer. paddingLeftEm (the
  // first-line position) is the uniform RN fallback when no native renderer is present.
  q: { paddingLeftEm: 0, hangIndentEm: [0, 2], marginBottomEm: POETRY_MB },
  q1: { paddingLeftEm: 0, hangIndentEm: [0, 2], marginBottomEm: POETRY_MB },
  q2: { paddingLeftEm: 1, hangIndentEm: [1, 2], marginBottomEm: POETRY_MB },
  q3: { paddingLeftEm: 1, hangIndentEm: [1, 3], marginBottomEm: POETRY_MB },
  q4: { paddingLeftEm: 2, hangIndentEm: [2, 4], marginBottomEm: POETRY_MB },
  qc: { align: 'center', marginBottomEm: PARA_MB },
  qr: { align: 'right', marginBottomEm: PARA_MB },
  qs: { align: 'right', italic: true, marginTopEm: PARA_MB, marginBottomEm: PARA_MB },
  qm: { paddingLeftEm: 0, hangIndentEm: [0, 2], marginBottomEm: POETRY_MB },
  qm1: { paddingLeftEm: 0, hangIndentEm: [0, 2], marginBottomEm: POETRY_MB },
  qm2: { paddingLeftEm: 1, hangIndentEm: [1, 2], marginBottomEm: POETRY_MB },

  // Lists — CSS pairs `padding-inline-start` (li/li1 2em…li4 5em) with
  // `text-indent: -1.5em` for a hanging first line. hangIndentEm [first, wrapped] feeds
  // the native hanging renderer; paddingLeftEm (the wrapped position) is the RN fallback.
  li: { paddingLeftEm: 2, hangIndentEm: [0.5, 2] },
  li1: { paddingLeftEm: 2, hangIndentEm: [0.5, 2] },
  li2: { paddingLeftEm: 3, hangIndentEm: [1.5, 3] },
  li3: { paddingLeftEm: 4, hangIndentEm: [2.5, 4] },
  li4: { paddingLeftEm: 5, hangIndentEm: [3.5, 5] },
}

export const INLINE_STYLES: Record<string, InlineStyleSpec> = {
  wj: { color: 'red' }, // Words of Jesus
  nd: { smallCaps: true }, // Name of Deity
  sc: { smallCaps: true }, // Small-cap text
  bd: { bold: true },
  em: { italic: true },
  it: { italic: true },
  tl: { italic: true },
  sls: { italic: true },
  add: { italic: true }, // Translator addition
  bk: { italic: true }, // Book name
  qt: { italic: true }, // Quoted OT text
  qac: { italic: true }, // Acrostic letter
  bdit: { bold: true, italic: true },
  k: { bold: true, italic: true }, // Keyword
  // Footnote inner character styles (used when expanding `.yv-n` content):
  fr: { bold: true }, // Footnote reference (verse number)
  fq: { italic: true },
  fqa: { italic: true },
  fk: { bold: true, italic: true },
  fl: { bold: true, italic: true },
  no: {}, // Normal — resets ancestor italic/bold (handled by not inheriting)
}

/** `.b`, `.lb`, `.sd` are vertical spacers (stanza/section breaks). */
export const SPACER_CLASSES = new Set(['b', 'lb', 'sd', 'ib'])

export type ScriptureStyleContext = {
  /** The reader's current base font size in px (from reader settings). */
  baseFontSize: number
  /** Body line-height multiplier (CSS root is 1.625). */
  lineHeightMultiplier: number
  /** Canonical reader font family (serif by default). */
  fontFamily: FontFamily
  palette: ScripturePalette
}

/** First class with a block spec wins (USFM elements carry one block marker). */
export function getBlockSpec(classes: string[]): BlockStyleSpec | undefined {
  for (const cls of classes) {
    const spec = BLOCK_STYLES[cls]
    if (spec) return spec
  }
  return undefined
}

/**
 * Resolve a paragraph/heading/poetry block's container `TextStyle`. Falls back to
 * a plain body paragraph when no block class matches (e.g. a bare `<p>`).
 */
export function resolveBlockTextStyle(classes: string[], ctx: ScriptureStyleContext): TextStyle {
  const spec = getBlockSpec(classes) ?? {}
  const fontSize = ctx.baseFontSize * (spec.fontSizeEm ?? 1)
  const style: TextStyle = {
    fontSize,
    lineHeight: fontSize * (spec.lineHeightEm ?? ctx.lineHeightMultiplier),
    color: ctx.palette.foreground,
    fontFamily: resolveBodyFontFamily(ctx.fontFamily, {
      bold: spec.bold,
      italic: spec.italic,
    }),
  }
  if (spec.bold) style.fontWeight = 'bold'
  if (spec.italic) style.fontStyle = 'italic'
  if (spec.align) style.textAlign = spec.align
  if (spec.marginTopEm) style.marginTop = ctx.baseFontSize * spec.marginTopEm
  if (spec.marginBottomEm) style.marginBottom = ctx.baseFontSize * spec.marginBottomEm
  if (spec.paddingLeftEm) style.paddingLeft = ctx.baseFontSize * spec.paddingLeftEm
  return style
}

/**
 * Resolve the combined `TextStyle` for a run of inline character styles. Multiple
 * classes compose (e.g. `wj` + `add`), and `parentFontSize` carries the cascade so
 * nested em sizes (footnote `fv` inside `note`) compound like CSS.
 */
export function resolveInlineTextStyle(
  classes: string[],
  ctx: ScriptureStyleContext,
  parentFontSize: number,
): TextStyle {
  let bold = false
  let italic = false
  let smallCaps = false
  let fontSizeEm = 1
  let color: string | undefined

  for (const cls of classes) {
    const spec = INLINE_STYLES[cls]
    if (!spec) continue
    if (spec.bold) bold = true
    if (spec.italic) italic = true
    if (spec.smallCaps) smallCaps = true
    if (spec.fontSizeEm) fontSizeEm *= spec.fontSizeEm
    if (spec.color === 'red') color = ctx.palette.red
    if (spec.color === 'muted') color = ctx.palette.mutedForeground
  }

  const fontSize = parentFontSize * fontSizeEm
  const style: TextStyle = {
    fontSize,
    fontFamily: resolveBodyFontFamily(ctx.fontFamily, { bold, italic }),
  }
  if (color) style.color = color
  if (bold) style.fontWeight = 'bold'
  if (italic) style.fontStyle = 'italic'
  if (smallCaps) style.fontVariant = ['small-caps']
  return style
}
