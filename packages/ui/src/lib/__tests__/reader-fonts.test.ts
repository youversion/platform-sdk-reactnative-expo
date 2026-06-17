import {
  decodeFontFamilyFromDom,
  encodeFontFamilyForDom,
  FONT_FAMILY_TOKEN,
  INTER_FONT,
  SOURCE_SERIF_FONT,
} from '../reader-fonts'

describe('reader-fonts bridge tokens', () => {
  it('encodes the canonical font stacks to quote-free tokens', () => {
    expect(encodeFontFamilyForDom(SOURCE_SERIF_FONT)).toBe(FONT_FAMILY_TOKEN.SOURCE_SERIF)
    expect(encodeFontFamilyForDom(INTER_FONT)).toBe(FONT_FAMILY_TOKEN.INTER)
  })

  it('produces tokens that contain no double quotes (the bridge hazard)', () => {
    for (const family of [SOURCE_SERIF_FONT, INTER_FONT]) {
      expect(encodeFontFamilyForDom(family)).not.toContain('"')
    }
  })

  it('decodes tokens back to the exact Web SDK canonical stacks', () => {
    expect(decodeFontFamilyFromDom(FONT_FAMILY_TOKEN.SOURCE_SERIF)).toBe(SOURCE_SERIF_FONT)
    expect(decodeFontFamilyFromDom(FONT_FAMILY_TOKEN.INTER)).toBe(INTER_FONT)
  })

  it('round-trips known font families losslessly', () => {
    for (const family of [SOURCE_SERIF_FONT, INTER_FONT]) {
      expect(decodeFontFamilyFromDom(encodeFontFamilyForDom(family))).toBe(family)
    }
  })

  it('passes unknown values through unchanged in both directions', () => {
    expect(encodeFontFamilyForDom('Comic Sans MS, cursive')).toBe('Comic Sans MS, cursive')
    expect(decodeFontFamilyFromDom('Comic Sans MS, cursive')).toBe('Comic Sans MS, cursive')
  })

  it('preserves undefined', () => {
    expect(encodeFontFamilyForDom(undefined)).toBeUndefined()
    expect(decodeFontFamilyFromDom(undefined)).toBeUndefined()
  })
})
