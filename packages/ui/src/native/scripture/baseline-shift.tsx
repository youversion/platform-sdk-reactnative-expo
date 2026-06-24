import type { ReactNode } from 'react'
import { Platform, Text, View } from 'react-native'

/**
 * Baseline shift — the shared primitive behind native super/subscript. Superscript
 * and subscript are the same operation in opposite directions: text shifted off the
 * baseline (up for super, down for sub).
 *
 * RN ignores `transform` on a *nested* `<Text>` (nested text is merged into the
 * parent's attributed string, so only text attributes apply). But an **inline
 * `<View>`** inside the flowing `<Text>` is a real view, so its `translateY` *does*
 * raise/lower it while staying in the text flow. The inner `<Text>` keeps the
 * **real characters**, so this works for any numeral system / script
 * (Western-Arabic, Arabic-Indic, Devanagari, CJK, …) — important for the 1,200+
 * Bible languages.
 *
 * Inline views in text are platform-sensitive (baseline alignment, line height) and
 * the right shift depends on the surrounding context (font size, line height,
 * start-of-line vs mid-text). The default `riseEm` values are tuned for the reader's
 * verse numbers; pass a `riseEm` override where a context needs a different lift
 * (e.g. the mid-text footnote markers in the footnote drawer).
 */
export const SCRIPT_SCALE = 0.65
export const SUPERSCRIPT_RISE_EM = Platform.select({ android: 0.1, default: -0.35 })
export const SUBSCRIPT_DROP_EM = 0.12

/**
 * Mid-text superscript markers (the footnote-drawer verse letters) sit lower than
 * the reader's start-of-line verse numbers at the same default rise, because the
 * surrounding run is full-height text on both sides rather than line-leading. Lift
 * them further so they ride near the cap height the way a superscript should. Tuned
 * per platform off `SUPERSCRIPT_RISE_EM` (RN inline-view baseline alignment differs).
 */
export const MIDTEXT_SUPERSCRIPT_RISE_EM = Platform.select({ android: -0.1, default: -0.55 })

export type BaselineShiftProps = {
  /** Font size of the surrounding run; the shifted text scales/shifts relative to it. */
  fontSize: number
  color?: string
  fontFamily?: string
  onPress?: () => void
  /** Vertical shift as a fraction of `fontSize` (negative = up). Defaults to the tuned value. */
  riseEm?: number
  children: ReactNode
}

function BaselineShift({
  fontSize,
  color,
  fontFamily,
  onPress,
  children,
  riseEm,
}: BaselineShiftProps & { riseEm: number }): ReactNode {
  return (
    <View style={{ transform: [{ translateY: fontSize * riseEm }] }}>
      <Text onPress={onPress} style={{ fontSize: fontSize * SCRIPT_SCALE, color, fontFamily }}>
        {children}
      </Text>
    </View>
  )
}

export function Superscript({ riseEm = SUPERSCRIPT_RISE_EM, ...props }: BaselineShiftProps): ReactNode {
  return <BaselineShift {...props} riseEm={riseEm} />
}

export function Subscript({ riseEm = SUBSCRIPT_DROP_EM, ...props }: BaselineShiftProps): ReactNode {
  return <BaselineShift {...props} riseEm={riseEm} />
}
