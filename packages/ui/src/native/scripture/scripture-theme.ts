import type { Theme } from '../../lib/resolve-theme'

/**
 * Concrete colors for native scripture rendering, translated from the Web SDK's
 * `@youversion/platform-core/src/styles/theme.css` `--yv-*` tokens (light/dark).
 * The DOM reader inherits these as CSS custom properties; native land cannot, so
 * we resolve them to hex here (same approach as `native-sheet-theme.ts`).
 */
export type ScripturePalette = {
  /** Body text — `--yv-foreground`. */
  foreground: string
  /** Reading surface background — `--yv-background`. */
  background: string
  /** Verse numbers / muted text — `--yv-muted-foreground`. */
  mutedForeground: string
  /** Words of Jesus (`.wj`) — `--yv-red`. */
  red: string
  /** Footnote marker — `--yv-gray-20`. */
  footnoteMarker: string
  /** Selected-verse underline — `--yv-border`. */
  border: string
}

export const SCRIPTURE_PALETTE: Record<Theme, ScripturePalette> = {
  light: {
    foreground: '#121212', // gray-50
    background: '#ffffff', // white
    mutedForeground: '#636161', // gray-30
    red: '#ff3d4d', // --yv-red
    footnoteMarker: '#bfbdbd', // gray-20
    border: '#dddbdb', // gray-15
  },
  dark: {
    foreground: '#ffffff', // white
    background: '#121212', // gray-50
    mutedForeground: '#edebeb', // gray-10
    red: '#f04c59', // --yv-red-dark-mode
    footnoteMarker: '#bfbdbd', // gray-20
    border: '#474545', // gray-35
  },
}
