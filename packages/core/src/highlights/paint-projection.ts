/** Six-digit hex, no `#`. Case-insensitive at the boundary. */
const HIGHLIGHT_HEX_PATTERN = /^[0-9a-f]{6}$/i

/** Whether `color` is a paintable highlight hex (palette or custom). */
export function isValidHighlightHex(color: string): boolean {
  return HIGHLIGHT_HEX_PATTERN.test(color)
}
