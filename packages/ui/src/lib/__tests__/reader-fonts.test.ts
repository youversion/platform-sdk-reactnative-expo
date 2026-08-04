import {
  decodeFontFamilyFromDom,
  encodeFontFamilyForDom,
  FONT_FAMILY_TOKEN,
  INTER_FONT,
  SOURCE_SERIF_FONT,
  UNTITLED_SERIF_FONT,
} from '../reader-fonts'

const KNOWN_FONTS = [SOURCE_SERIF_FONT, UNTITLED_SERIF_FONT, INTER_FONT]

describe('reader-fonts bridge tokens', () => {
  it('encodes the canonical font stacks to quote-free tokens', () => {
    expect(encodeFontFamilyForDom(SOURCE_SERIF_FONT)).toBe(FONT_FAMILY_TOKEN.SOURCE_SERIF)
    expect(encodeFontFamilyForDom(UNTITLED_SERIF_FONT)).toBe(FONT_FAMILY_TOKEN.UNTITLED_SERIF)
    expect(encodeFontFamilyForDom(INTER_FONT)).toBe(FONT_FAMILY_TOKEN.INTER)
  })

  it('produces tokens that contain no double quotes (the bridge hazard)', () => {
    for (const family of KNOWN_FONTS) {
      expect(encodeFontFamilyForDom(family)).not.toContain('"')
    }
  })

  it('decodes tokens back to the exact Web SDK canonical stacks', () => {
    expect(decodeFontFamilyFromDom(FONT_FAMILY_TOKEN.SOURCE_SERIF)).toBe(SOURCE_SERIF_FONT)
    expect(decodeFontFamilyFromDom(FONT_FAMILY_TOKEN.UNTITLED_SERIF)).toBe(UNTITLED_SERIF_FONT)
    expect(decodeFontFamilyFromDom(FONT_FAMILY_TOKEN.INTER)).toBe(INTER_FONT)
  })

  it('round-trips known font families losslessly', () => {
    for (const family of KNOWN_FONTS) {
      expect(decodeFontFamilyFromDom(encodeFontFamilyForDom(family))).toBe(family)
    }
  })

  it('passes unknown values through unchanged in both directions', () => {
    expect(encodeFontFamilyForDom('Comic Sans MS, cursive')).toBe('Comic Sans MS, cursive')
    expect(decodeFontFamilyFromDom('Comic Sans MS, cursive')).toBe('Comic Sans MS, cursive')
  })

  it('decodes undefined to undefined (DOM reader fontFamily is optional)', () => {
    expect(decodeFontFamilyFromDom(undefined)).toBeUndefined()
  })
})
