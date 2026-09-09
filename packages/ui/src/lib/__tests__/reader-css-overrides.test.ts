import { readerRendererCss, sanitizeCssValue } from '../reader-css-overrides'

describe('sanitizeCssValue', () => {
  it('strips braces and semicolons that would break a CSS declaration', () => {
    expect(sanitizeCssValue(' #fff; }{ ')).toBe('#fff')
  })
})

describe('readerRendererCss', () => {
  it('maps consumer hex onto --yv-background and --yv-foreground', () => {
    const css = readerRendererCss({
      backgroundColor: '#ffffff',
      foregroundColor: '#121212',
    })

    expect(css).toContain('[data-slot="yv-bible-renderer"]')
    expect(css).toContain('--yv-background: #ffffff !important;')
    expect(css).toContain('--yv-foreground: #121212 !important;')
    expect(css).not.toContain('--yv-reader-bg')
    expect(css).not.toContain('--yv-reader-fg')
  })

  it('does not emit font CSS — fonts are Web SDK props', () => {
    const css = readerRendererCss({
      backgroundColor: '#ffffff',
    })

    expect(css).not.toContain('--yv-reader-font-size')
    expect(css).not.toContain('--yv-reader-font-family')
  })

  it('returns an empty string when there is nothing to override', () => {
    expect(readerRendererCss({})).toBe('')
  })

  it('sanitizes color values before interpolating them', () => {
    const css = readerRendererCss({
      backgroundColor: '#fff; } body { color: red',
    })

    expect(css).toContain('--yv-background: #fff  body  color: red !important;')
    expect(css).not.toContain('body {')
  })
})
