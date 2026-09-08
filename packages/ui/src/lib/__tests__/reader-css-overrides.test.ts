import { readerRendererCss, sanitizeCssValue } from '../reader-css-overrides'

describe('sanitizeCssValue', () => {
  it('strips braces and semicolons that would break a CSS declaration', () => {
    expect(sanitizeCssValue(' #fff; }{ ')).toBe('#fff')
  })
})

describe('readerRendererCss', () => {
  it('maps token hex onto --yv-reader-bg and --yv-reader-fg', () => {
    const css = readerRendererCss({
      backgroundColor: '#ffffff',
      foregroundColor: '#121212',
    })

    expect(css).toContain('[data-slot="yv-bible-renderer"]')
    expect(css).toContain('--yv-reader-bg: #ffffff !important;')
    expect(css).toContain('--yv-reader-fg: #121212 !important;')
  })

  it('maps font size and family onto --yv-reader-font-size and --yv-reader-font-family', () => {
    const css = readerRendererCss({
      fontSize: 18,
      fontFamily: '"Inter", sans-serif',
    })

    expect(css).toContain('--yv-reader-font-size: 18px !important;')
    expect(css).toContain('--yv-reader-font-family: "Inter", sans-serif !important;')
  })

  it('returns an empty string when there is nothing to override', () => {
    expect(readerRendererCss({})).toBe('')
  })

  it('sanitizes color and family values before interpolating them', () => {
    const css = readerRendererCss({
      backgroundColor: '#fff; } body { color: red',
      fontFamily: 'Inter; } html {',
    })

    expect(css).toContain('--yv-reader-bg: #fff  body  color: red !important;')
    expect(css).toContain('--yv-reader-font-family: Inter  html !important;')
    expect(css).not.toContain('body {')
    expect(css).not.toContain('html {')
  })
})
