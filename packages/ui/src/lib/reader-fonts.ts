/**
 * Mirrors the font-family constants in `@youversion/platform-react-ui`'s
 * `lib/verse-html-utils`, which are not currently re-exported from the
 * package's public entry. We need exact string-match parity so that
 * `BibleThemeSettingsContent`'s selected-button highlighting works when we
 * pass these values into the DOM wrapper.
 */
export const INTER_FONT = '"Inter", sans-serif' as const
export const SOURCE_SERIF_FONT = '"Source Serif 4", serif' as const

export type FontFamily =
  | typeof INTER_FONT
  | typeof SOURCE_SERIF_FONT
  | (string & {})
