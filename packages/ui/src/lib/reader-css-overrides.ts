/**
 * Reader appearance the Web SDK paints from CSS custom properties on
 * `[data-slot="yv-bible-renderer"]`. Hex colors come from the ported token
 * set; font size/family are consumer overrides. Nothing here is a hardcoded
 * reader palette.
 */
export type ReaderCssOverrides = {
  backgroundColor?: string
  foregroundColor?: string
  fontSize?: number
  fontFamily?: string
}

/** Strip CSS-breaking characters before interpolating a value into a declaration. */
export function sanitizeCssValue(value: string): string {
  return value.replace(/[{};]/g, '').trim()
}

/**
 * Builds the `--yv-reader-*` rule block the DOM scripture surface injects.
 * Empty when nothing to override, so the caller can skip the `<style>` tag.
 */
export function readerRendererCss(overrides: ReaderCssOverrides): string {
  const declarations: string[] = []

  if (overrides.backgroundColor) {
    declarations.push(`--yv-reader-bg: ${sanitizeCssValue(overrides.backgroundColor)} !important;`)
  }
  if (overrides.foregroundColor) {
    declarations.push(`--yv-reader-fg: ${sanitizeCssValue(overrides.foregroundColor)} !important;`)
  }
  if (overrides.fontSize != null) {
    declarations.push(`--yv-reader-font-size: ${overrides.fontSize}px !important;`)
  }
  if (overrides.fontFamily) {
    declarations.push(
      `--yv-reader-font-family: ${sanitizeCssValue(overrides.fontFamily)} !important;`,
    )
  }

  if (declarations.length === 0) {
    return ''
  }

  return `[data-slot="yv-bible-renderer"] {
          ${declarations.join('\n          ')}
        }`
}
