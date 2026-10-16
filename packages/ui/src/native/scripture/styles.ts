// USFM block and character styles from the format tool's reader
// (yvp-bible-format `bible-reader-overrides.css`). Indents are em, so they
// grow with the font. Poetry is 2/4/6/8em. Lists step 2/3/4/5em.

import { READER_LINE_SPACING } from '../../stores/types/reader-line-spacing'

type Weight = 400 | 500 | 700

type BlockRule = {
  align?: 'center' | 'right'
  /** Multiple of the reader font size. */
  size?: number
  weight?: Weight
  italic?: boolean
  smallCaps?: boolean
  /** Margins in em. */
  mT?: number
  mB?: number
  /** First-line indent in em, and whole-block indent in em. */
  first?: number
  head?: number
}

const TITLE = { size: 1.17, weight: 500 } as const
const SUBTITLE = { size: 1, weight: 500 } as const

const BLOCK_RULES = new Map<string, BlockRule>([
  ['p', { mB: 0.6, first: 1, head: 0 }],
  ['ip', { mB: 0.6, first: 1, head: 0 }],
  ['m', { mT: 0.5, mB: 0.5, first: 0, head: 0 }],
  ['im', { mT: 0.5, mB: 0.5, first: 0, head: 0 }],
  ['pi', { mT: 0.5, mB: 0.5, first: 1, head: 0 }],
  ['pi1', { mB: 0.6, first: 1, head: 0 }],
  ['ipi', { mB: 0.6, first: 1, head: 1 }],
  ['iex', { first: 1, head: 0 }],
  ['imi', { mB: 0.6, first: 0, head: 2 }],
  ['ipq', { italic: true, first: 1, head: 2 }],
  ['ipr', { italic: true, align: 'right' }],
  ['pi2', { first: 2, head: 1 }],
  ['pi3', { first: 4, head: 3 }],
  ['pm', { mT: 0.5, mB: 0.5, first: 0, head: 2 }],
  ['pmc', { mT: 0.5, mB: 0.5, first: 0, head: 2 }],
  ['pmo', { mT: 0.5, mB: 0.5, first: 0, head: 2 }],
  ['pmr', { align: 'right', mB: 0.5 }],
  ['pc', { align: 'center', smallCaps: true, mB: 0.6 }],
  ['po', { mT: 0.25, mB: 0.25, first: 1 }],
  ['q', { first: 0, head: 2 }],
  ['q1', { first: 0, head: 2 }],
  ['q2', { first: 0, head: 4 }],
  ['q3', { first: 0, head: 6 }],
  ['q4', { first: 0, head: 8 }],
  ['qm', { mT: 0.5, mB: 0.5, head: 2 }],
  ['qm1', { mT: 0.5, mB: 0.5, head: 2 }],
  ['qm2', { mT: 0.5, mB: 0.5, head: 4 }],
  ['qm3', { mT: 0.5, mB: 0.5, head: 6 }],
  ['qm4', { mT: 0.5, mB: 0.5, head: 8 }],
  ['qa', { ...TITLE, italic: true, mT: 0.5, mB: 0.5 }],
  ['qc', { align: 'center', mT: 0, mB: 0 }],
  ['qr', { align: 'right', italic: true }],
  ['li', { first: 0, head: 2 }],
  ['li1', { first: 0, head: 2 }],
  ['ili', { first: 0, head: 2 }],
  ['ili1', { first: 0, head: 2 }],
  ['lim', { first: 0, head: 3 }],
  ['lim1', { first: 0, head: 3 }],
  ['mi', { first: 0, head: 2 }],
  ['li2', { first: 0, head: 3 }],
  ['ili2', { first: 0, head: 3 }],
  ['li3', { first: 0, head: 4 }],
  ['li4', { first: 0, head: 5 }],
  ['lh', { mT: 0.5, first: 1 }],
  ['io', { head: 2 }],
  ['io1', { head: 2 }],
  ['io2', { head: 3 }],
  ['io3', { head: 4 }],
  ['nb', { first: 0, head: 0 }],
  ['d', { align: 'center', italic: true, mT: 0.6, mB: 1.2 }],
  ['s', { ...TITLE, mT: 1, mB: 0.25, first: 0, head: 0 }],
  ['s1', { ...TITLE, mT: 1, mB: 0.25, first: 0, head: 0 }],
  ['s2', { ...SUBTITLE, italic: true, mT: 0.5, mB: 0.5 }],
  ['s3', { ...SUBTITLE, italic: true, mT: 0.5, mB: 0.5 }],
  ['s4', { ...SUBTITLE, italic: true, mT: 0.5, mB: 0.5 }],
  ['sp', { ...TITLE, italic: true, mT: 0.5, mB: 0.5 }],
  ['sr', { ...SUBTITLE, align: 'center', mB: 0.25 }],
  ['r', { italic: true, mT: 0, mB: 0.5 }],
  ['mr', { ...TITLE, align: 'center', italic: true, mT: 0, mB: 0.6 }],
  ['ms', { ...SUBTITLE, align: 'center', mT: 0, mB: 0.6 }],
  ['ms1', { ...TITLE, align: 'center', mT: 0.5, mB: 0.5 }],
  ['ms2', { ...SUBTITLE, align: 'center', mT: 0.5, mB: 0.5 }],
  ['ms3', { ...SUBTITLE, align: 'center', mT: 0.5, mB: 0.5 }],
  ['ms4', { ...SUBTITLE, align: 'center', mT: 0.5, mB: 0.5 }],
  ['mt', { size: 1.6, weight: 700, mT: 0.25, mB: 0.5 }],
  ['mt1', { size: 1.6, weight: 700, mT: 0.25, mB: 0.5 }],
  ['mt2', { size: 1.3, weight: 500, italic: true, mB: 0.25 }],
  ['imt', { ...TITLE, weight: 700 }],
  ['imt1', { size: 1.17, weight: 700, mT: 1, mB: 0.25 }],
  ['imt2', { size: 1.08, italic: true, mT: 0.5, mB: 0.25 }],
  ['imte', { weight: 700, mT: 1, mB: 0.25 }],
  ['imte1', { weight: 700, mT: 1, mB: 0.25 }],
  ['imte2', { italic: true, align: 'center', mT: 0.5, mB: 0.15 }],
  ['iot', { weight: 700, mT: 0.5, mB: 0.5 }],
  ['is1', { size: 1.17, weight: 700, mT: 0.5, mB: 0.5 }],
  ['is2', { weight: 700, mT: 0.5, mB: 0.5 }],
  ['cd', { italic: true }],
  ['qd', { italic: true }],
  ['pr', { align: 'right' }],
])

export type ResolvedBlock = {
  size: number
  weight: Weight
  italic: boolean
  smallCaps: boolean
  align: 'left' | 'center' | 'right'
  /** Em margins before collapse; `bottom` excludes the line-spacing leading. */
  top: number
  bottom: number
  firstIndent: number
  headIndent: number
  /** Room each side of a centred or right-aligned block, before the highlight end room. */
  alignInset: { start: number; end: number }
}

// Swift aligns a block inside `HStack { Spacer(); text; Spacer() }`; each spacer keeps
// its 8pt minimum (a stack adds no spacing beside a spacer), so the text never reaches the gutter.
const SPACER_INSET = 8

/** Merges every class's rule, later classes winning, then resolves px for font size `F`. */
export function resolveBlock(classes: readonly string[], fontSize: number): ResolvedBlock {
  const rule: BlockRule = {}
  for (const name of classes) {
    Object.assign(rule, BLOCK_RULES.get(name))
  }
  // `r` and `cd` inside a `yv-h` header are the medium italic line.
  if ((classes.includes('r') || classes.includes('cd')) && classes.includes('yv-h')) {
    rule.weight = 500
  }
  const centred = rule.align === 'center'
  return {
    size: fontSize * (rule.size ?? 1),
    weight: rule.weight ?? 400,
    italic: rule.italic ?? false,
    smallCaps: rule.smallCaps ?? false,
    align: rule.align ?? 'left',
    top: rule.mT ?? 0,
    bottom: rule.mB ?? 0,
    firstIndent: centred ? 0 : fontSize * (rule.first ?? 0),
    headIndent: centred ? 0 : fontSize * (rule.head ?? 0),
    alignInset: {
      start: rule.align === undefined ? 0 : SPACER_INSET,
      end: centred ? SPACER_INSET : 0,
    },
  }
}

/** CSS-style collapse: the larger of the two margins, the first block flush. */
export function collapsedMarginTop(
  block: ResolvedBlock,
  previous: ResolvedBlock | null,
  fontSize: number,
): number {
  if (previous === null) {
    return 0
  }
  return Math.max(0, block.top - previous.bottom) * fontSize
}

// Swift adds F*frac of leading to the font's natural line (~1.24F for the serif, measured at
// 18pt); the store keeps the Web multiplier, so each step maps to Swift's fraction.
const NATURAL_LINE = 1.24

/** Line height as a multiple of the font size. */
export function lineMultiple(lineSpacing: number): number {
  switch (lineSpacing) {
    case READER_LINE_SPACING.SM:
      return NATURAL_LINE + 0.3
    case READER_LINE_SPACING.LG:
      return NATURAL_LINE + 0.6
    default:
      return NATURAL_LINE + 0.4
  }
}

/**
 * Swift pads each block by the leading SwiftUI leaves off its last line; RN's
 * lineHeight already includes it, so only the margin remains.
 */
export function blockMarginBottom(block: ResolvedBlock, fontSize: number): number {
  return block.bottom * fontSize
}

export type ResolvedChars = {
  wordsOfJesus: boolean
  smallCaps: boolean
  italic: boolean
  weight: Weight | null
  /** Multiple of the block size, or `null` to inherit. */
  scale: number | null
  /** Sits on the verse-number baseline offset. */
  raised: boolean
}

const ITALIC = new Set([
  'tl',
  'it',
  'add',
  'em',
  'fq',
  'fqa',
  'qac',
  'qs',
  'qt',
  'bk',
  'sig',
  'litl',
  'sls',
  'iqt',
])

export function resolveChars(classes: readonly string[]): ResolvedChars {
  const chars: ResolvedChars = {
    wordsOfJesus: false,
    smallCaps: false,
    italic: false,
    weight: null,
    scale: null,
    raised: false,
  }
  for (const name of classes) {
    if (name === 'wj') {
      chars.wordsOfJesus = true
    } else if (name === 'nd' || name === 'sc') {
      chars.smallCaps = true
    } else if (ITALIC.has(name)) {
      chars.italic = true
    } else if (name === 'bd' || name === 'k' || name === 'fr') {
      chars.weight = 700
    } else if (name === 'bdit' || name === 'fk' || name === 'fl') {
      chars.weight = 500
      chars.italic = true
    } else if (name === 'rq') {
      chars.italic = true
      chars.scale = 0.83
    } else if (name === 'ord' || name === 'fv' || name === 'sup') {
      chars.scale = LABEL_SCALE
      chars.raised = true
    }
  }
  return chars
}

/** Verse numbers and superscripts, as a multiple of the reader size. */
export const LABEL_SCALE = 0.65
