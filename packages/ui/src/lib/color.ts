/**
 * Turns a `#rrggbb` token into an `rgba()` string for the dark-only alpha fills
 * the web SDK writes as `destructive/60`. Tokens stay hex because React Native
 * needs a literal color and `theme/__tests__/tokens.test.ts` bans `rgb(` there.
 */
export function withAlpha(hex: string, alpha: number): string {
  const digits = /^#([0-9a-f]{6})$/i.exec(hex)?.[1]
  if (digits === undefined) {
    throw new Error(`withAlpha expects a #rrggbb color, received "${hex}"`)
  }
  const value = Number.parseInt(digits, 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

const RGBA = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)$/i

/**
 * Multiplies a color's alpha by `factor`. Hex goes through {@link withAlpha};
 * `rgba(...)` keeps its channels and scales the existing alpha — so a translucent
 * marker can dim without feeding `rgba` back into `withAlpha`.
 */
export function scaleAlpha(color: string, factor: number): string {
  const match = RGBA.exec(color)
  if (match !== null) {
    const [, r, g, b, alpha] = match
    return `rgba(${r}, ${g}, ${b}, ${Number(alpha) * factor})`
  }
  return withAlpha(color, factor)
}
