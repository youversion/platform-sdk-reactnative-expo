import { INTER_FONT, type FontFamily } from '../../lib/reader-fonts'

/**
 * Native font resolution for the scripture renderer.
 *
 * The Web SDK reader uses CSS font stacks (`"Source Serif 4", serif` for body,
 * `"Inter", sans-serif` for verse labels). React Native needs a *registered*
 * family name per weight/style — there is no synthetic bold/italic for custom
 * families. We map to the `@expo-google-fonts/*` registered names; the consumer
 * app must load them (e.g. `apps/example` via `useFonts`). When a variant is not
 * loaded, RN falls back to the system font, so callers should still set
 * `fontWeight`/`fontStyle` alongside for a graceful (if non-parity) fallback.
 */
export type FontStyleVariant = { bold?: boolean; italic?: boolean }

type VariantSet = {
  regular: string
  bold: string
  italic: string
  boldItalic: string
}

const SOURCE_SERIF_4: VariantSet = {
  regular: 'SourceSerif4_400Regular',
  bold: 'SourceSerif4_700Bold',
  italic: 'SourceSerif4_400Regular_Italic',
  boldItalic: 'SourceSerif4_700Bold_Italic',
}

const INTER: VariantSet = {
  regular: 'Inter_400Regular',
  bold: 'Inter_700Bold',
  italic: 'Inter_400Regular_Italic',
  boldItalic: 'Inter_700Bold_Italic',
}

/** Family names the consumer app must register for full reader parity. */
export const REQUIRED_FONT_FAMILIES = [
  ...Object.values(SOURCE_SERIF_4),
  ...Object.values(INTER),
] as const

function pickVariant(set: VariantSet, { bold, italic }: FontStyleVariant): string {
  if (bold && italic) return set.boldItalic
  if (bold) return set.bold
  if (italic) return set.italic
  return set.regular
}

/** Resolve the body reader font (serif by default) for a weight/style variant. */
export function resolveBodyFontFamily(
  fontFamily: FontFamily,
  variant: FontStyleVariant = {},
): string {
  const set = fontFamily === INTER_FONT ? INTER : SOURCE_SERIF_4
  return pickVariant(set, variant)
}

/** Verse labels (`.yv-vlbl`) always render in the sans family. */
export function resolveLabelFontFamily(variant: FontStyleVariant = {}): string {
  return pickVariant(INTER, variant)
}
