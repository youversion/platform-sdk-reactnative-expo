/** `#rgb` or `#rrggbb` (any case) as lowercase `#rrggbb`; anything else is `null`. */
export function toHex6(color: string): string | null {
  const value = color.trim().toLowerCase()
  const long = /^#([0-9a-f]{6})$/.exec(value)
  if (long !== null) {
    return value
  }
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(value)
  if (short === null) {
    return null
  }
  const [, r = '0', g = '0', b = '0'] = short
  return `#${r}${r}${g}${g}${b}${b}`
}

function channels(hex6: string): [number, number, number] {
  const value = Number.parseInt(hex6.replace('#', ''), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** Web `isDarkHighlightHex`: Rec.601 luma below half. Takes server hex, `#` optional. */
export function isDarkHighlightHex(hex: string): boolean {
  const [r, g, b] = channels(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5
}

/** Opaque sRGB mix, `color-mix(in srgb, top ratio, bottom)`. Both inputs `#rrggbb`. */
export function mixHex(top: string, bottom: string, ratio: number): string {
  const a = channels(top)
  const b = channels(bottom)
  const mixed = a.map((channel, i) => Math.round(channel * ratio + (b[i] ?? 0) * (1 - ratio)))
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export type HighlightPaint = {
  background: string
  /** White ink for a dark swatch in light mode; `null` keeps the reader's ink. */
  text: string | null
}

const DARK_MIX = 0.2

/**
 * Pre-mixes the swatch against the reader background, as the DOM reader does
 * with `color-mix` (100% light, 20% dark). Opaque, so nothing stacks.
 */
export function highlightPaint(
  color: string,
  theme: 'light' | 'dark',
  background: string,
  lightInk: string,
): HighlightPaint {
  const swatch = `#${color.replace('#', '').toLowerCase()}`
  if (theme === 'dark') {
    return { background: mixHex(swatch, background, DARK_MIX), text: null }
  }
  return { background: swatch, text: isDarkHighlightHex(swatch) ? lightInk : null }
}
