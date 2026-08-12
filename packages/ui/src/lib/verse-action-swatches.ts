import type { HighlightColor, ServerColors } from '@youversion/platform-react-native-expo-core'
import {
  HIGHLIGHT_COLORS,
  isHighlightColor,
  isValidHighlightHex,
} from '@youversion/platform-react-native-expo-core'

/**
 * One circle in the verse action sheet's swatch tray.
 *
 * `state` is what a press does, not what the swatch looks like. `'remove'`
 * renders the checkmark and clears that color. `'apply'` renders the bare circle
 * and paints it.
 */
export type VerseActionSwatch =
  | { color: HighlightColor; state: 'apply' }
  | { color: string; state: 'remove' }

export type BuildVerseActionSwatchesInput = {
  /** The verses currently selected in the reader. */
  verses: readonly number[]
  /**
   * Verse to color for the chapter on screen, optimistic paint included. It is
   * `deriveServerColors(highlights, scope)` over what `useHighlights` returns.
   */
  colors: ServerColors
}

/**
 * Builds the swatch tray for a selection: a remove circle for every color
 * present on *any* selected verse, then the apply circles, both in canonical
 * palette order.
 *
 * The apply row offers the whole palette when part of the selection is
 * unhighlighted, or when the selection already carries more than one active
 * color (palette or valid non-palette hex). Otherwise it offers only the
 * palette colors not already present. Apply is palette-only; remove includes
 * valid non-palette hex at its exact value. Invalid hex is dropped from both
 * rows.
 */
export function buildVerseActionSwatches(
  input: BuildVerseActionSwatchesInput,
): VerseActionSwatch[] {
  const { verses, colors } = input

  const activePaletteColors = new Set<HighlightColor>()
  const activeNonPaletteColors = new Set<string>()
  const activeColors = new Set<string>()
  let highlightedVerseCount = 0
  for (const verse of verses) {
    const color = colors[verse]
    if (color === undefined || !isValidHighlightHex(color)) {
      continue
    }
    const normalized = color.toLowerCase()
    activeColors.add(normalized)
    if (isHighlightColor(normalized)) {
      activePaletteColors.add(normalized)
    } else {
      activeNonPaletteColors.add(normalized)
    }
    highlightedVerseCount += 1
  }

  const unHighlightedCount = verses.length - highlightedVerseCount
  const allPaletteColorsActive = activePaletteColors.size === HIGHLIGHT_COLORS.length
  const showAllApplyColors =
    !allPaletteColorsActive &&
    (unHighlightedCount > 0 || activeColors.size > 1)
  const colorsToApply = showAllApplyColors
    ? HIGHLIGHT_COLORS
    : HIGHLIGHT_COLORS.filter((color) => !activePaletteColors.has(color))

  const removeSwatches: VerseActionSwatch[] = [
    ...HIGHLIGHT_COLORS.filter((color) => activePaletteColors.has(color)).map(
      (color): VerseActionSwatch => ({ color, state: 'remove' }),
    ),
    ...[...activeNonPaletteColors].sort().map(
      (color): VerseActionSwatch => ({ color, state: 'remove' }),
    ),
  ]

  return [
    ...removeSwatches,
    ...colorsToApply.map((color): VerseActionSwatch => ({ color, state: 'apply' })),
  ]
}
