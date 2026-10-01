import { highlightPaint, isDarkHighlightHex, mixHex, toHex6 } from '../highlight-colors'

const WHITE = '#ffffff'
const BLACK = '#000000'

describe('highlightPaint', () => {
  it('paints the full swatch in light mode and keeps the reader ink on a light swatch', () => {
    expect(highlightPaint('fffe00', 'light', WHITE, WHITE)).toEqual({
      background: '#fffe00',
      text: null,
    })
  })

  it('switches to the light ink on a dark swatch in light mode', () => {
    expect(highlightPaint('#1F3A93', 'light', WHITE, WHITE)).toEqual({
      background: '#1f3a93',
      text: WHITE,
    })
  })

  it('mixes 20% of the swatch into the background in dark mode and keeps the ink', () => {
    // 0.2 * 255 + 0.8 * 0 = 51 → 0x33; 0.2 * 254 = 50.8 → 0x33.
    expect(highlightPaint('fffe00', 'dark', BLACK, WHITE)).toEqual({
      background: '#333300',
      text: null,
    })
  })
})

describe('mixHex', () => {
  it('returns each end at ratio 1 and 0', () => {
    expect(mixHex('#5dff79', '#121212', 1)).toBe('#5dff79')
    expect(mixHex('#5dff79', '#121212', 0)).toBe('#121212')
  })
})

describe('isDarkHighlightHex', () => {
  it('splits on Rec.601 luma at one half', () => {
    expect(isDarkHighlightHex('fffe00')).toBe(false)
    expect(isDarkHighlightHex('1f3a93')).toBe(true)
  })
})

describe('toHex6', () => {
  it('expands short hex, lowercases, and rejects non-hex', () => {
    expect(toHex6('#ABC')).toBe('#aabbcc')
    expect(toHex6('#00909F')).toBe('#00909f')
    expect(toHex6('rgb(0, 0, 0)')).toBeNull()
  })
})
