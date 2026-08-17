/** Slack, in px, before a fade retires at the edge it guards. */
export const FADE_GATE_PX = 1

/**
 * Live swatch-tray measurements. Widths and offset always travel together;
 * fade visibility is a function of the triple, not of any one number.
 */
export type SwatchTrayMetrics = {
  trayWidth: number
  contentWidth: number
  scrollX: number
}

export type SwatchTrayFadeGates = {
  hasScrolledPast: boolean
  hasMoreToScroll: boolean
}

/**
 * Whether each end of the swatch tray still has hidden content under it.
 *
 * Leading (`hasScrolledPast`) gates on distance already scrolled. Trailing
 * (`hasMoreToScroll`) gates on remaining scroll distance. Both use
 * `FADE_GATE_PX` of slack so a fade retires at the edge it guards rather than
 * staying up for raw overflow.
 */
export function swatchTrayFadeGates(metrics: SwatchTrayMetrics): SwatchTrayFadeGates {
  const { trayWidth, contentWidth, scrollX } = metrics
  return {
    hasScrolledPast: scrollX > FADE_GATE_PX,
    hasMoreToScroll: contentWidth - trayWidth - scrollX > FADE_GATE_PX,
  }
}
