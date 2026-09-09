import { FONT_FAMILY_TOKEN, INTER_FONT } from '../reader-fonts'
import { bibleTextViewDomSurface } from '../bible-text-view-dom-surface'

describe('bibleTextViewDomSurface', () => {
  it('forwards resolved theme for the in-WebView YouVersionProvider', () => {
    expect(bibleTextViewDomSurface({ theme: 'dark' }).theme).toBe('dark')
  })

  it('defaults theme to light when native omitted it', () => {
    expect(bibleTextViewDomSurface({}).theme).toBe('light')
  })

  it('decodes fontFamily and forwards fontSize as Web SDK props, not reader CSS', () => {
    const surface = bibleTextViewDomSurface({
      fontFamily: FONT_FAMILY_TOKEN.INTER,
      fontSize: 18,
    })

    expect(surface.fontFamily).toBe(INTER_FONT)
    expect(surface.fontSize).toBe(18)
    expect(Object.keys(surface).sort()).toEqual(['fontFamily', 'fontSize', 'theme'])
    expect(JSON.stringify(surface)).not.toContain('--yv-reader-')
    expect(JSON.stringify(surface)).not.toContain('!important')
  })
})
