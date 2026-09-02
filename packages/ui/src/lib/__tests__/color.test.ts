import { withAlpha } from '../color'

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
