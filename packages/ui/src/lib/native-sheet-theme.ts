import type { Theme } from './resolve-theme'

/**
 * Colors for the native bottom-sheet chrome rendered by @gorhom/bottom-sheet
 * (background surface behind the handle and rounded corners, plus the drag
 * handle indicator). These live in native land, so they cannot inherit the
 * Web SDK theme the DOM content uses — they must be themed explicitly.
 *
 * Sheet Surface Parity: the native chrome and the DOM WebView render the same
 * visual surface in two different engines, so these tokens MUST track the Web
 * SDK's CSS tokens or a seam appears where chrome meets WebView:
 *   - SHEET_SURFACE         === --yv-background (--yv-white / --yv-gray-50)
 *   - SHEET_MUTED_BACKGROUND === --yv-muted      (--yv-gray-5 / --yv-gray-40)
 * If the Web SDK changes those values, update these to match.
 */

/** Background surface behind the sheet chrome (handle area, rounded top corners). Mirrors --yv-background. */
export const SHEET_SURFACE: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#121212',
}

/** Drag-handle indicator color. */
export const SHEET_HANDLE: Record<Theme, string> = {
  light: '#cccccc',
  dark: '#5a5757',
}

/**
 * Muted surface used behind a search bar at the bottom of picker sheets. Mirrors
 * the Web SDK --yv-muted so the native footer inset meets the DOM search section
 * with no seam.
 */
export const SHEET_MUTED_BACKGROUND: Record<Theme, string> = {
  light: '#f6f4f4',
  dark: '#353333',
}
