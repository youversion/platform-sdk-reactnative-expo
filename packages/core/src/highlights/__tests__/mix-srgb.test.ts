import { mixSrgb } from '../constants'

describe('mixSrgb', () => {
  it('is identity in light (p = 1.00)', () => {
    expect(mixSrgb('ffec5b', 'ffffff', 1)).toBe('ffec5b')
    expect(mixSrgb('#ffec5b', '#ffffff', 1)).toBe('ffec5b')
    expect(mixSrgb('fffe00', 'ffffff', 1)).toBe('fffe00')
  })

  it('mixes dark p = 0.20 against #121212', () => {
    expect(mixSrgb('ffec5b', '121212', 0.2)).toBe('413e21')
    expect(mixSrgb('b4ffc1', '#121212', 0.2)).toBe('324135')
    expect(mixSrgb('bbf4ff', '121212', 0.2)).toBe('343f41')
    expect(mixSrgb('ffdca7', '121212', 0.2)).toBe('413a30')
    expect(mixSrgb('ffcff8', '121212', 0.2)).toBe('413840')
    expect(mixSrgb('dfdcff', '121212', 0.2)).toBe('3b3a41')
    expect(mixSrgb('fffe00', '121212', 0.2)).toBe('41410e')
  })
})
