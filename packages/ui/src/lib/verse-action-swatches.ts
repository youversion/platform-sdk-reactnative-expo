import type { HighlightColor, ServerColors } from '@youversion/platform-react-native-expo-core'
import { HIGHLIGHT_COLORS, isHighlightColor } from '@youversion/platform-react-native-expo-core'

/**
 * One circle in the verse action sheet's swatch tray.
 *
 * `state` is what a press *does*, not what the swatch looks like: `'remove'`
 * renders the checkmark and clears that colour, `'apply'` renders the bare
 * circle and paints it.
 */
export type VerseActionSwatch = { color: HighlightColor; state: 'apply' | 'remove' }

export type BuildVerseActionSwatchesInput = {
  /** The verses currently selected in the reader. */
  verses: readonly number[]
  /**
   * Verse → colour for the chapter on screen, optimistic paint included —
   * `deriveServerColors(highlights, scope)` over the array `useHighlights`
   * returns, which already merges the overlay.
   */
  colors: ServerColors
}

/**
 * Which swatches the verse action sheet shows, and in what order.
 *
 * **This is a port of the Web SDK's shipped rule, not a re-derivation.** Until
 * this phase the tray lived inside the WebView (`VerseActionPopover`), so the
 * rule was the Web SDK's to own; moving the tray to native moves the rule here,
 * and porting it is what keeps RN and web from diverging on the same screen.
 * The two halves come from `../platform-sdk-react`:
 *
 * - `activeHighlights` (`components/bible-reader.tsx`) is an **ANY** rule —
 *   every distinct colour present *anywhere* in the selection earns a remove
 *   circle, not only colours on *all* the selected verses. iOS is believed to
 *   use the ALL rule, but nobody here has read that code or seen the two
 *   side by side, so the readable rule wins. Switching is the one predicate
 *   below; see ADR 0015.
 * - `verse-action-popover.tsx` then orders remove circles before apply circles,
 *   both in canonical palette order, and shows the full apply row only when
 *   `!allColorsActive && (unHighlightedCount > 0 || activeHighlights.size > 1)`.
 *
 * Colours outside the five swatches are ignored entirely, matching web: the
 * projection the WebView paints from (`deriveHighlightedVerses`) drops them, so
 * counting them here would size the tray against paint the user cannot see.
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
  // Web's rule, verbatim: offer the whole palette when part of the selection is
  // bare or the selection already carries more than one colour — the cases
  // where "apply this everywhere" is a meaningful action even for a colour that
  // is already present somewhere.
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
