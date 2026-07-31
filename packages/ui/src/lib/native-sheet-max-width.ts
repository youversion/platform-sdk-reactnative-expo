/**
 * Width cap for the Native Sheet surface on wide screens (iPad, landscape
 * phones, desktop-class windows). Below the cap, sheets stay full-width.
 *
 * Implemented as a horizontal margin on @gorhom/bottom-sheet's `style` prop
 * (the BottomSheetBody — handle, background, content, and footer all live
 * inside it, while the backdrop renders as a sibling and keeps covering the
 * full screen). The body is absolutely positioned with `left: 0, right: 0`
 * applied after any provided style, so `maxWidth`/`alignSelf` would anchor it
 * to the left edge; a computed symmetric margin is the only deterministic way
 * to both cap and center it.
 */
export const SHEET_MAX_WIDTH = 640

/**
 * Symmetric horizontal margin that caps the sheet at SHEET_MAX_WIDTH and
 * centers it. Returns 0 (full-width sheet) at or below the cap, or for
 * non-finite/unmeasured widths.
 */
export function sheetHorizontalMargin(windowWidth: number): number {
  if (!Number.isFinite(windowWidth) || windowWidth <= SHEET_MAX_WIDTH) return 0
  return (windowWidth - SHEET_MAX_WIDTH) / 2
}
