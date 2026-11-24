import { scaleAlpha, withAlpha } from '../color'

describe('withAlpha', () => {
  it('expands a lowercase hex token into rgba channels', () => {
    expect(withAlpha('#ff3d4d', 0.6)).toBe('rgba(255, 61, 77, 0.6)')
  })

  it('accepts uppercase hex and a fully opaque alpha', () => {
    expect(withAlpha('#00909F', 1)).toBe('rgba(0, 144, 159, 1)')
  })

  it('throws on anything that is not a six-digit hex color', () => {
    expect(() => withAlpha('#fff', 0.3)).toThrow(/#rrggbb/)
  })
})

describe('scaleAlpha', () => {
  it('forwards hex through withAlpha', () => {
    expect(scaleAlpha('#3366ff', 0.35)).toBe('rgba(51, 102, 255, 0.35)')
  })

  it('multiplies an existing rgba alpha instead of throwing', () => {
    expect(scaleAlpha('rgba(51, 102, 255, 0.5)', 0.35)).toBe('rgba(51, 102, 255, 0.175)')
  })

  it('expands short and 8-digit hex instead of throwing', () => {
    expect(scaleAlpha('#36f', 0.35)).toBe('rgba(51, 102, 255, 0.35)')
    expect(scaleAlpha('#3366ff80', 0.35)).toBe('rgba(51, 102, 255, 0.35)')
  })
})
