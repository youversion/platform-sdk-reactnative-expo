/**
 * Optional reader color overrides the Web SDK actually consumes.
 * Ink and surface read `--yv-foreground` / `--yv-background` — not
 * `--yv-reader-bg` / `--yv-reader-fg` (those names are unused in
 * `@youversion/platform-react-ui` 2.12.0).
 *
 * Font size and family are Web SDK props, not stylesheet overrides.
 */
export type ReaderCssOverrides = {
  backgroundColor?: string
  foregroundColor?: string
}

/** Strip CSS-breaking characters before interpolating a value into a declaration. */
export function sanitizeCssValue(value: string): string {
  return value.replace(/[{};]/g, '').trim()
}

/**
 * Builds the `--yv-background` / `--yv-foreground` rule block for a consumer
 * color override (BibleReader). Empty when nothing to override.
 */
export function readerRendererCss(overrides: ReaderCssOverrides): string {
  const declarations: string[] = []

  if (overrides.backgroundColor) {
    declarations.push(`--yv-background: ${sanitizeCssValue(overrides.backgroundColor)} !important;`)
  }
  if (overrides.foregroundColor) {
    declarations.push(`--yv-foreground: ${sanitizeCssValue(overrides.foregroundColor)} !important;`)
  }

  if (declarations.length === 0) {
    return ''
  }

  return `[data-slot="yv-bible-renderer"] {
          ${declarations.join('\n          ')}
        }`
}
