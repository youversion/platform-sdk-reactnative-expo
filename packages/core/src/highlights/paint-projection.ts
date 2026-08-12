import type { ServerColors } from './constants'

/** Six-digit hex, no `#`. Case-insensitive at the boundary. */
const HIGHLIGHT_HEX_PATTERN = /^[0-9a-f]{6}$/i

/** Whether `color` is a paintable highlight hex (palette or custom). */
export function isValidHighlightHex(color: string): boolean {
  return HIGHLIGHT_HEX_PATTERN.test(color)
}

/**
 * Drops verses whose color is not a valid highlight hex. Normalizes survivors to
 * lowercase. Palette membership is not checked — callers gate apply separately.
 */
export function projectPaintColors(colors: ServerColors): ServerColors {
  const projected: ServerColors = {}
  for (const [verseKey, color] of Object.entries(colors)) {
    const normalized = color.toLowerCase()
    if (isValidHighlightHex(normalized)) {
      projected[Number(verseKey)] = normalized
    }
  }
  return projected
}
