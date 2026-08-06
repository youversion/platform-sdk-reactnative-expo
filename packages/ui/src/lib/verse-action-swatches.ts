import type { HighlightColor, ServerColors } from '@youversion/platform-react-native-expo-core'
import { HIGHLIGHT_COLORS, isHighlightColor } from '@youversion/platform-react-native-expo-core'

/**
 * One circle in the verse action sheet's swatch tray.
 *
 * `state` is what a press does, not what the swatch looks like. `'remove'`
 * renders the checkmark and clears that color. `'apply'` renders the bare circle
 * and paints it.
 */
export type VerseActionSwatch = { color: HighlightColor; state: 'apply' | 'remove' }

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
 * unhighlighted, or when the selection already carries more than one color.
 * Otherwise it offers only the colors not already present. Colors outside
 * `HIGHLIGHT_COLORS` are ignored, because the reader does not paint them either.
 */
export function buildVerseActionSwatches(
  input: BuildVerseActionSwatchesInput,
): VerseActionSwatch[] {
  const { verses, colors } = input

  const activeColors = new Set<HighlightColor>()
  let highlightedVerseCount = 0
  for (const verse of verses) {
    const color = colors[verse]
    if (color === undefined || !isHighlightColor(color)) {
      continue
    }
    activeColors.add(color)
    highlightedVerseCount += 1
  }

  const unHighlightedCount = verses.length - highlightedVerseCount
  const allColorsActive = activeColors.size === HIGHLIGHT_COLORS.length
  // The whole palette is offered when part of the selection is bare, or when the
  // selection already carries more than one color. In both cases "apply this
  // everywhere" still means something for a color already present somewhere.
  const showAllApplyColors = !allColorsActive && (unHighlightedCount > 0 || activeColors.size > 1)
  const colorsToApply = showAllApplyColors
    ? HIGHLIGHT_COLORS
    : HIGHLIGHT_COLORS.filter((color) => !activeColors.has(color))

  return [
    ...HIGHLIGHT_COLORS.filter((color) => activeColors.has(color)).map(
      (color): VerseActionSwatch => ({ color, state: 'remove' }),
    ),
    ...colorsToApply.map((color): VerseActionSwatch => ({ color, state: 'apply' })),
  ]
}
