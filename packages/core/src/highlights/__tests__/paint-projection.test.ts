import { HIGHLIGHT_COLORS, type ServerColors } from '../constants'
import { isValidHighlightHex, projectPaintColors } from '../paint-projection'

const [YELLOW] = HIGHLIGHT_COLORS

describe('isValidHighlightHex', () => {
  it('accepts lowercase and uppercase six-digit hex', () => {
    expect(isValidHighlightHex('fffe00')).toBe(true)
    expect(isValidHighlightHex('FFFE00')).toBe(true)
    expect(isValidHighlightHex('123456')).toBe(true)
  })

  it('rejects hash-prefixed, short, long, and non-hex values', () => {
    expect(isValidHighlightHex('#fffe00')).toBe(false)
    expect(isValidHighlightHex('fff')).toBe(false)
    expect(isValidHighlightHex('gg0000')).toBe(false)
    expect(isValidHighlightHex('')).toBe(false)
  })
})

describe('projectPaintColors', () => {
  it('keeps valid non-palette hex and normalizes case', () => {
    const colors: ServerColors = { 1: '123456', 2: 'AaBbCc' }
    expect(projectPaintColors(colors)).toEqual({ 1: '123456', 2: 'aabbcc' })
  })

  it('keeps palette hex', () => {
    expect(projectPaintColors({ 16: YELLOW })).toEqual({ 16: YELLOW })
  })

  it('drops invalid hex from paint', () => {
    const colors: ServerColors = { 1: YELLOW, 2: 'gg0000', 3: '123456' }
    expect(projectPaintColors(colors)).toEqual({ 1: YELLOW, 3: '123456' })
  })
})
