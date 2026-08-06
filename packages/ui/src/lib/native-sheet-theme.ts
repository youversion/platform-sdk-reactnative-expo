import type { BoxShadowValue } from 'react-native'

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

/**
 * Primary on-surface color: body text, icons, and the fill of a solid button.
 * Mirrors the Web SDK --yv-foreground.
 */
export const SHEET_FOREGROUND: Record<Theme, string> = {
  light: '#121212',
  dark: '#ffffff',
}

/**
 * Label color for a button filled with {@link SHEET_FOREGROUND}, which inverts
 * the surface and so needs the surface's own color back for its text.
 */
export const SHEET_INVERSE_FOREGROUND: Record<Theme, string> = {
  light: '#ffffff',
  dark: '#121212',
}

/** Secondary on-surface color: supporting paragraphs and eyebrow labels. Mirrors --yv-muted-foreground. */
export const SHEET_MUTED_FOREGROUND: Record<Theme, string> = {
  light: '#6b6a6a',
  dark: '#a8a5a5',
}

/** Hairline border on an outlined control drawn over the sheet surface. {@link SHEET_FOREGROUND} at 20%. */
export const SHEET_STROKE: Record<Theme, string> = {
  light: 'rgba(18, 18, 18, 0.2)',
  dark: 'rgba(255, 255, 255, 0.2)',
}

/**
 * Upward drop shadow separating a sheet's top edge from the content behind it.
 * Two layers, the way Material fakes elevation: a tight contact shadow for the
 * edge and a wide ambient one for depth.
 *
 * Uses `boxShadow` because `shadowColor` is iOS-only and Android's `elevation`
 * cannot be aimed above an edge; the typed array form is used over the string
 * form. Requires the New Architecture (mandatory from Expo SDK 55) and Android
 * API 28+ for outset shadows — below that the sheet renders unshadowed.
 *
 * Dark mode carries much higher alpha because a black shadow has little
 * luminance to spend against a near-black surface.
 */
export const SHEET_TOP_SHADOW: Record<Theme, readonly BoxShadowValue[]> = {
  light: [
    { offsetX: 0, offsetY: -2, blurRadius: 4, color: 'rgba(18, 18, 18, 0.06)' },
    { offsetX: 0, offsetY: -16, blurRadius: 32, color: 'rgba(18, 18, 18, 0.14)' },
  ],
  dark: [
    { offsetX: 0, offsetY: -2, blurRadius: 4, color: 'rgba(0, 0, 0, 0.5)' },
    { offsetX: 0, offsetY: -16, blurRadius: 32, color: 'rgba(0, 0, 0, 0.7)' },
  ],
}
