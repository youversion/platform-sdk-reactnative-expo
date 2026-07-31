import { SHEET_MAX_WIDTH, sheetHorizontalMargin } from '../native-sheet-max-width'

describe('sheetHorizontalMargin', () => {
  it('keeps sheets full-width below the cap (phones)', () => {
    expect(sheetHorizontalMargin(320)).toBe(0)
    expect(sheetHorizontalMargin(430)).toBe(0)
  })

  it('keeps sheets full-width exactly at the cap', () => {
    expect(sheetHorizontalMargin(SHEET_MAX_WIDTH)).toBe(0)
  })

  it('caps the sheet at SHEET_MAX_WIDTH and centers it on wide screens', () => {
    // 11" iPad portrait
    expect(sheetHorizontalMargin(834)).toBe((834 - SHEET_MAX_WIDTH) / 2)
    // 13" iPad landscape
    expect(sheetHorizontalMargin(1376)).toBe((1376 - SHEET_MAX_WIDTH) / 2)
  })

  it('leaves exactly SHEET_MAX_WIDTH for the sheet after both margins', () => {
    const windowWidth = 1024
    const margin = sheetHorizontalMargin(windowWidth)
    expect(windowWidth - 2 * margin).toBe(SHEET_MAX_WIDTH)
  })

  it('returns 0 for unmeasured or non-finite widths', () => {
    expect(sheetHorizontalMargin(0)).toBe(0)
    expect(sheetHorizontalMargin(Number.NaN)).toBe(0)
    expect(sheetHorizontalMargin(Number.POSITIVE_INFINITY)).toBe(0)
  })
})
