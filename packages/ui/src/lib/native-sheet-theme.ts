import type { BoxShadowValue } from 'react-native'

import { getTokens, palette } from '../theme'
import { withAlpha } from './color'
import type { Theme } from './resolve-theme'

const light = getTokens('light')
const dark = getTokens('dark')

/** Elevation shadow color. Dark uses black; a near-black surface has no luminance to spend. */
function blackAt(alpha: number): string {
  return `rgba(0, 0, 0, ${alpha})`
}

/**
 * Colors for the native bottom-sheet chrome rendered by @gorhom/bottom-sheet
 * (background surface behind the handle and rounded corners, plus the drag
 * handle indicator). These live in native land, so they cannot inherit the
 * Web SDK theme the DOM content uses — they must be themed explicitly.
 *
 * Sheet Surface Parity: the native chrome and the DOM WebView render the same
 * visual surface in two different engines, so these values are derived from
 * the ported tokens rather than copied hex:
 *   - SHEET_SURFACE         === background
 *   - SHEET_MUTED_BACKGROUND === muted
 * Gorhom-only chrome (handle, stroke, shadows) maps onto the existing palette
 * / semantic tokens. No sheet-specific token names.
 */

/** Background surface behind the sheet chrome (handle area, rounded top corners). */
export const SHEET_SURFACE = {
  light: light.background,
  dark: dark.background,
} satisfies Record<Theme, string>

/** Drag-handle indicator. Nearest palette steps to the old off-palette chrome hex. */
export const SHEET_HANDLE = {
  light: palette.gray20,
  dark: palette.gray30,
} satisfies Record<Theme, string>

/**
 * Muted surface used behind a search bar at the bottom of picker sheets. The
 * native footer inset meets the DOM search section with no seam.
 */
export const SHEET_MUTED_BACKGROUND = {
  light: light.muted,
  dark: dark.muted,
} satisfies Record<Theme, string>

/**
 * Primary on-surface color: body text, icons, and the fill of a solid button.
 */
export const SHEET_FOREGROUND = {
  light: light.foreground,
  dark: dark.foreground,
} satisfies Record<Theme, string>

/**
 * Label color for a button filled with {@link SHEET_FOREGROUND}, which inverts
 * the surface and so needs the surface's own color back for its text.
 */
export const SHEET_INVERSE_FOREGROUND = {
  light: light.background,
  dark: dark.background,
} satisfies Record<Theme, string>

/** Secondary on-surface color: supporting paragraphs and eyebrow labels. */
export const SHEET_MUTED_FOREGROUND = {
  light: light.mutedForeground,
  dark: dark.mutedForeground,
} satisfies Record<Theme, string>

/** Hairline border on an outlined control drawn over the sheet surface. */
export const SHEET_STROKE = {
  light: withAlpha(light.foreground, 0.2),
  dark: withAlpha(dark.foreground, 0.2),
} satisfies Record<Theme, string>

/**
 * Upward drop shadow separating a sheet's top edge from the content behind it.
 * Two layers, the way Material fakes elevation: a tight contact shadow for the
 * edge and a wide ambient one for depth.
 *
 * The shadow uses `boxShadow` in its typed array form, not the string form.
 * `shadowColor` is iOS-only, and Android's `elevation` cannot be aimed above an
 * edge. Outset shadows need the New Architecture (mandatory from Expo SDK 55)
 * and Android API 28 or later. Below that the sheet renders unshadowed.
 *
 * Dark mode carries much higher alpha, because a black shadow has little
 * luminance to spend against a near-black surface.
 */
export const SHEET_TOP_SHADOW = {
  light: [
    { offsetX: 0, offsetY: -2, blurRadius: 4, color: withAlpha(light.foreground, 0.06) },
    { offsetX: 0, offsetY: -16, blurRadius: 32, color: withAlpha(light.foreground, 0.14) },
  ],
  dark: [
    { offsetX: 0, offsetY: -2, blurRadius: 4, color: blackAt(0.5) },
    { offsetX: 0, offsetY: -16, blurRadius: 32, color: blackAt(0.7) },
  ],
} satisfies Record<Theme, readonly BoxShadowValue[]>
