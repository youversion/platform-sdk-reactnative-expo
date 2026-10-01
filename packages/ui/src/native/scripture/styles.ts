// USFM block and character styles from the Swift/Kotlin readers
// (.claude/plans/native-reader-style-spec.md §2, §4). Native beats Web.

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
  /** First-line indent units (0.75em each) and whole-block indent units (8pt each). */
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
  ['pi', { mT: 0.5, mB: 0.5, first: 0, head: 0 }],
  ['pi1', { mB: 0.6, first: 1, head: 2 }],
  ['ipi', { mB: 0.6, first: 1, head: 2 }],
  ['pi2', { first: 1, head: 4 }],
  ['pi3', { first: 1, head: 6 }],
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
  ['qm', { mT: 0.5, mB: 0.5, head: 0 }],
  ['qm1', { mT: 0.5, mB: 0.5, head: 2 }],
  ['qm2', { mT: 0.5, mB: 0.5, head: 4 }],
  ['qm3', { mT: 0.5, mB: 0.5, head: 6 }],
  ['qm4', { mT: 0.5, mB: 0.5, head: 8 }],
  ['qa', { ...TITLE, italic: true, mT: 0.5, mB: 0.5 }],
  ['qc', { align: 'center', mT: 0, mB: 0 }],
  ['qr', { align: 'right', italic: true }],
  ['li', { first: 0, head: 2 }],
  ['li1', { first: 0, head: 2 }],
  ['lim', { first: 0, head: 2 }],
  ['mi', { first: 0, head: 2 }],
  ['li2', { first: 0, head: 4 }],
  ['li3', { first: 0, head: 6 }],
  ['li4', { first: 0, head: 8 }],
  ['lh', { mT: 0.5, first: 1 }],
  ['nb', { first: 0, head: 0 }],
  ['d', { align: 'center', italic: true, mT: 0.6, mB: 1.2 }],
  ['s', { ...TITLE, mT: 0, mB: 0.25, first: 0, head: 0 }],
  ['s1', { ...TITLE, mT: 0, mB: 0.25, first: 0, head: 0 }],
  ['s2', { ...SUBTITLE, italic: true, mT: 0.5, mB: 0.5 }],
  ['s3', { ...SUBTITLE, italic: true, mT: 0.5, mB: 0.5 }],
  ['s4', { ...SUBTITLE, italic: true, mT: 0.5, mB: 0.5 }],
  ['sp', { ...TITLE, italic: true, mT: 0.5, mB: 0.5 }],
  ['sr', { ...SUBTITLE, align: 'center', mB: 0.25 }],
  ['r', { align: 'center', italic: true, mT: 0, mB: 0.25 }],
  ['mr', { ...TITLE, align: 'center', italic: true, mT: 0, mB: 0.6 }],
  ['ms', { ...SUBTITLE, align: 'center', mT: 0, mB: 0.6 }],
  ['ms1', { ...TITLE, align: 'center', mT: 0.5, mB: 0.5 }],
  ['ms2', { ...SUBTITLE, align: 'center', mT: 0.5, mB: 0.5 }],
  ['ms3', { ...SUBTITLE, align: 'center', mT: 0.5, mB: 0.5 }],
  ['ms4', { ...SUBTITLE, align: 'center', mT: 0.5, mB: 0.5 }],
  ['mt1', { ...TITLE, align: 'center', mT: 0.25, mB: 0.5 }],
  ['mt2', { ...TITLE, align: 'center', italic: true, mB: 0.25 }],
  ['imt1', { size: 1.17, weight: 700, align: 'center', mT: 1, mB: 0.25 }],
  ['imt2', { size: 1.08, italic: true, align: 'center', mT: 0.5, mB: 0.25 }],
  ['is1', { size: 1.17, weight: 700, align: 'center', mT: 0.5, mB: 0.5 }],
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
}

/** Merges every class's rule, later classes winning, then resolves pt values for font size `F`. */
export function resolveBlock(classes: readonly string[], fontSize: number): ResolvedBlock {
  const rule: BlockRule = {}
  for (const name of classes) {
    Object.assign(rule, BLOCK_RULES.get(name))
  }
  // `r` inside a `yv-h` header is the medium italic parallel-passage line.
  if (classes.includes('r') && classes.includes('yv-h')) {
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
    firstIndent: centred ? 0 : fontSize * 0.25 * Math.min(Math.max((rule.first ?? 0) * 3, 0), 24),
    headIndent: centred ? 0 : 8 * (rule.head ?? 0),
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

/** Native readers add the line's extra leading below every block; our spacing is a CSS multiplier. */
export function blockMarginBottom(
  block: ResolvedBlock,
  fontSize: number,
  lineSpacing: number,
): number {
  return block.bottom * fontSize + fontSize * Math.max(0, lineSpacing - 1.2)
}

export type ResolvedChars = {
  wordsOfJesus: boolean
  smallCaps: boolean
  italic: boolean
  weight: Weight | null
  /** Multiple of the block size, or `null` to inherit. */
  scale: number | null
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
])

export function resolveChars(classes: readonly string[]): ResolvedChars {
  const chars: ResolvedChars = {
    wordsOfJesus: false,
    smallCaps: false,
    italic: false,
    weight: null,
    scale: null,
  }
  for (const name of classes) {
    if (name === 'wj') {
      chars.wordsOfJesus = true
    } else if (name === 'nd' || name === 'sc') {
      chars.smallCaps = true
    } else if (ITALIC.has(name)) {
      chars.italic = true
    } else if (name === 'bd') {
      chars.weight = 700
    } else if (name === 'bdit' || name === 'fk' || name === 'fl') {
      chars.weight = 500
      chars.italic = true
    } else if (name === 'rq') {
      chars.italic = true
      chars.scale = 0.83
    } else if (name === 'ord' || name === 'fv' || name === 'sup') {
      chars.scale = LABEL_SCALE
    }
  }
  return chars
}

/** Verse numbers and superscripts, as a multiple of the reader size. */
export const LABEL_SCALE = 0.65
