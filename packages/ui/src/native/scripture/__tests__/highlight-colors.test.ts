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
  it('expands short hex and lowercases', () => {
    expect(toHex6('#ABC')).toBe('#aabbcc')
    expect(toHex6('#00909F')).toBe('#00909f')
    expect(toHex6('rgb(0, 0, 0)')).toBe('#000000')
  })

  it('reads the formats hosts pass, dropping alpha', () => {
    expect(toHex6('#00909F80')).toBe('#00909f')
    expect(toHex6('#abc8')).toBe('#aabbcc')
    expect(toHex6('rgb(250, 245, 235)')).toBe('#faf5eb')
    expect(toHex6('rgba(250,245,235,0.5)')).toBe('#faf5eb')
    expect(toHex6(' White ')).toBe('#ffffff')
    expect(toHex6('black')).toBe('#000000')
  })

  it('rejects what it cannot mix', () => {
    expect(toHex6('rgb(256, 0, 0)')).toBeNull()
    expect(toHex6('hsl(0, 0%, 100%)')).toBeNull()
    expect(toHex6('rebeccapurple')).toBeNull()
    expect(toHex6('transparent')).toBeNull()
    expect(toHex6('#abcde')).toBeNull()
  })
})
