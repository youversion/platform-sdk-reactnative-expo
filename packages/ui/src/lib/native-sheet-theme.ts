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
 * Upward drop shadow separating the sheet's top edge from the content behind it.
 *
 * **Why `boxShadow` and not `shadow*` / `elevation`.** RN's `shadowColor` family
 * is iOS-only, and Android's `elevation` casts a shadow that cannot be aimed —
 * neither can put a shadow *above* an edge on both platforms. `boxShadow` is the
 * CSS-spec prop RN added in 0.76 for exactly this, it takes a negative `offsetY`,
 * and it is cross-platform. It requires the New Architecture, which Expo SDK 55+
 * makes mandatory (the legacy architecture was removed outright), so every
 * consumer of this SDK has it. The array form is used over the string form
 * because it is typed.
 *
 * Two layers, the way Material fakes elevation: a tight contact shadow for the
 * edge itself and a wide ambient one for depth.
 *
 * **This matters most on the verse action sheet**, which is non-modal and so has
 * no backdrop dimming the passage behind it — without a shadow its top edge is
 * genuinely hard to find. Modal sheets keep it too; behind a dimmed backdrop it
 * is simply invisible, which is cheaper than branching on `modal`.
 *
 * Dark mode leans on much higher alpha because a black shadow has very little
 * luminance to spend against a near-black surface. It is a real improvement, not
 * a complete substitute for the light-mode effect.
 *
 * Known limitation: outset `boxShadow` needs Android API 28+. Below that the
 * sheet renders with no shadow — degraded, not broken.
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
