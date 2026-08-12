import { isValidHighlightHex } from '../paint-projection'

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
