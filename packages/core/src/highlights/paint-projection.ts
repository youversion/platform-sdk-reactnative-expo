/** Six-digit hex, no `#`. Case-insensitive at the boundary. */
const HIGHLIGHT_HEX_PATTERN = /^[0-9a-f]{6}$/i

/** Whether `color` is a paintable highlight hex (palette or custom). */
export function isValidHighlightHex(color: string): boolean {
  return HIGHLIGHT_HEX_PATTERN.test(color)
}

function stripHighlightHexPrefix(color: string): string {
  return color.startsWith('#') ? color.slice(1) : color
}

function requireMixHex(color: string): string {
  const hex = stripHighlightHexPrefix(color)
  if (!isValidHighlightHex(hex)) {
    throw new Error(`mixSrgb: expected a 6-digit hex color, got ${JSON.stringify(color)}`)
  }
  return hex
}

function hexChannel(hex: string, offset: number): number {
  return Number.parseInt(hex.slice(offset, offset + 2), 16)
}

function byteToHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0')
}

/**
 * `stored * p + surfaceBg * (1 - p)`. Duplicated from
 * `@youversion/platform-react-ui` rather than imported: that package
 * peer-depends on `react-dom`. Returns lowercase hex, no `#`.
 * Invalid hex or `p` outside 0–1 throws.
 */
export function mixSrgb(stored: string, surfaceBg: string, p: number): string {
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new Error(`mixSrgb: expected p in the range 0–1, got ${p}`)
  }
  const storedHex = requireMixHex(stored)
  const surfaceHex = requireMixHex(surfaceBg)
  const q = 1 - p
  const r = hexChannel(storedHex, 0) * p + hexChannel(surfaceHex, 0) * q
  const g = hexChannel(storedHex, 2) * p + hexChannel(surfaceHex, 2) * q
  const b = hexChannel(storedHex, 4) * p + hexChannel(surfaceHex, 4) * q
  return `${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`
}
