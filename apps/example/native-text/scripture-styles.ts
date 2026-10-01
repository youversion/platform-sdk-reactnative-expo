// Port of the Web SDK 2.15 reader CSS (bible-reader.css) to RN styles, in
// multiples of the base font size F. q/li indents are flat padding since 2.12,
// so no hanging-indent native module is needed.
import type { TextStyle } from 'react-native'

export const LINE_HEIGHT = 1.625
export const LABEL_SCALE = 0.65

type BlockRule = {
  padStartEm?: number
  marginTopEm?: number
  marginBottomEm?: number
  indentFirstEm?: number
  align?: 'center' | 'end'
  sizeEm?: number
  weight?: 500
  italic?: boolean
}

const BLOCK_RULE_TABLE = {
  p: { indentFirstEm: 1, marginBottomEm: 0.6 },
  m: { marginTopEm: 0.5, marginBottomEm: 0.5 },
  pi: { marginTopEm: 0.5, marginBottomEm: 0.5, padStartEm: 1 },
  pm: { padStartEm: 1, marginTopEm: 0.5, marginBottomEm: 0.5 },
  pmo: { padStartEm: 1, marginTopEm: 0.5, marginBottomEm: 0.5 },
  pmc: { padStartEm: 1, marginTopEm: 0.5, marginBottomEm: 0.5 },
  q: { padStartEm: 2, marginBottomEm: 0.3 },
  q1: { padStartEm: 1 },
  q2: { padStartEm: 2 },
  q3: { padStartEm: 3 },
  q4: { padStartEm: 4 },
  qm: { padStartEm: 1, marginTopEm: 0.5, marginBottomEm: 0.5 },
  qc: { align: 'center' },
  qr: { align: 'end', italic: true },
  li: { padStartEm: 1 },
  li1: { padStartEm: 1 },
  li2: { padStartEm: 2 },
  li3: { padStartEm: 3 },
  li4: { padStartEm: 4 },
  s: { sizeEm: 1.17, weight: 500, marginBottomEm: 0.25 },
  s1: { sizeEm: 1.17, weight: 500, marginBottomEm: 0.25 },
  s2: { weight: 500, italic: true, marginTopEm: 0.5, marginBottomEm: 0.5 },
  s3: { weight: 500, italic: true, marginTopEm: 0.5, marginBottomEm: 0.5 },
  s4: { weight: 500, italic: true, marginTopEm: 0.5, marginBottomEm: 0.5 },
  ms: { align: 'center', weight: 500 },
  mr: { align: 'center', italic: true, sizeEm: 1.17 },
  r: { align: 'center', italic: true },
  d: { align: 'center', italic: true, marginTopEm: 0.6, marginBottomEm: 1.2 },
  qa: { sizeEm: 1.17, italic: true, weight: 500, marginTopEm: 0.5, marginBottomEm: 0.5 },
  b: { marginBottomEm: 1 },
} satisfies Record<string, BlockRule>

const BLOCK_RULES = new Map<string, BlockRule>(Object.entries(BLOCK_RULE_TABLE))

export type ResolvedBlock = {
  style: TextStyle
  indentFirst: number
  weight: 400 | 500
  italic: boolean
}

export function resolveBlock(
  classes: readonly string[],
  fontSize: number,
  rtl: boolean,
): ResolvedBlock {
  const rule: BlockRule = {}
  for (const c of classes) {
    Object.assign(rule, BLOCK_RULES.get(c))
  }
  const size = fontSize * (rule.sizeEm ?? 1)
  return {
    style: {
      fontSize: size,
      lineHeight: size * LINE_HEIGHT,
      paddingStart: size * (rule.padStartEm ?? 0),
      marginTop: size * (rule.marginTopEm ?? 0),
      marginBottom: size * (rule.marginBottomEm ?? 0),
      // The passage container sets `direction`, which already swaps left/right.
      textAlign: rule.align === 'center' ? 'center' : rule.align === 'end' ? 'right' : 'left',
      writingDirection: rtl ? 'rtl' : 'ltr',
    },
    indentFirst: fontSize * (rule.indentFirstEm ?? 0),
    weight: rule.weight ?? 400,
    italic: rule.italic ?? false,
  }
}

export type CharFlags = {
  italic: boolean
  bold: boolean
  medium: boolean
  smallCaps: boolean
  wordsOfJesus: boolean
}

export function resolveChars(classes: readonly string[]): CharFlags {
  const has = (...names: string[]): boolean => names.some((n) => classes.includes(n))
  return {
    italic: has('add', 'it', 'tl', 'qs', 'sig', 'bdit', 'k'),
    bold: has('bd', 'k'),
    medium: has('bdit'),
    smallCaps: has('nd', 'sc'),
    wordsOfJesus: has('wj'),
  }
}

/** Mirrors the SDK's `fontMapKey`: `Family[_medium|_bold][_italic]`. */
export function faceName(family: string, weight: 400 | 500 | 700, italic: boolean): string {
  const parts = [family]
  if (weight === 500) {
    parts.push('medium')
  } else if (weight === 700) {
    parts.push('bold')
  }
  if (italic) {
    parts.push('italic')
  }
  return parts.join('_')
}
