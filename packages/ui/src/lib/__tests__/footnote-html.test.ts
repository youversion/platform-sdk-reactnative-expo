import { footnoteMarker } from '../footnote-html'

describe('footnoteMarker', () => {
  it('counts a, z, then aa', () => {
    expect(footnoteMarker(0)).toBe('a')
    expect(footnoteMarker(1)).toBe('b')
    expect(footnoteMarker(25)).toBe('z')
    expect(footnoteMarker(26)).toBe('aa')
  })
})
