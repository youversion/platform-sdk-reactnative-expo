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

  it('is the surface at p = 0', () => {
    expect(mixSrgb('ffec5b', '121212', 0)).toBe('121212')
  })

  it('rejects invalid hex instead of emitting NaNNaNNaN', () => {
    expect(() => mixSrgb('nothex', 'ffffff', 1)).toThrow(/6-digit hex/)
    expect(() => mixSrgb('fff', 'ffffff', 1)).toThrow(/6-digit hex/)
    expect(() => mixSrgb('ffec5b', 'zzzzzz', 0.2)).toThrow(/6-digit hex/)
  })

  it('rejects p outside 0–1 instead of emitting wide channels', () => {
    expect(() => mixSrgb('ffec5b', 'ffffff', 1.5)).toThrow(/0–1/)
    expect(() => mixSrgb('ffec5b', 'ffffff', -0.1)).toThrow(/0–1/)
    expect(() => mixSrgb('ffec5b', 'ffffff', Number.NaN)).toThrow(/0–1/)
  })
})
