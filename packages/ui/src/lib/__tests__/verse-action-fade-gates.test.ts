/**
 * Layer 1 — remaining-distance fade gates for the verse action swatch tray.
 *
 * Layer 3 can only see the overlays after a full `BibleReader` boot. These
 * cases pin the arithmetic, including the 1px slack at each edge.
 */
import { FADE_GATE_PX, swatchTrayFadeGates } from '../verse-action-fade-gates'

const OVERFLOWING = { trayWidth: 200, contentWidth: 320 }

describe('swatchTrayFadeGates', () => {
  it('shows only the trailing fade at the head of an overflowing strip', () => {
    expect(swatchTrayFadeGates({ ...OVERFLOWING, scrollX: 0 })).toEqual({
      hasScrolledPast: false,
      hasMoreToScroll: true,
    })
  })

  it('shows both fades mid-strip', () => {
    expect(swatchTrayFadeGates({ ...OVERFLOWING, scrollX: 60 })).toEqual({
      hasScrolledPast: true,
      hasMoreToScroll: true,
    })
  })

  it('shows only the leading fade at the tail', () => {
    expect(swatchTrayFadeGates({ ...OVERFLOWING, scrollX: 120 })).toEqual({
      hasScrolledPast: true,
      hasMoreToScroll: false,
    })
  })

  it('shows neither fade when the strip fits', () => {
    expect(swatchTrayFadeGates({ trayWidth: 200, contentWidth: 200, scrollX: 0 })).toEqual({
      hasScrolledPast: false,
      hasMoreToScroll: false,
    })
  })

  it('keeps the leading fade retired until scroll passes the slack', () => {
    expect(swatchTrayFadeGates({ ...OVERFLOWING, scrollX: FADE_GATE_PX })).toEqual({
      hasScrolledPast: false,
      hasMoreToScroll: true,
    })
    expect(swatchTrayFadeGates({ ...OVERFLOWING, scrollX: FADE_GATE_PX + 0.01 })).toEqual({
      hasScrolledPast: true,
      hasMoreToScroll: true,
    })
  })

  it('retires the trailing fade once remaining distance is at the slack', () => {
    const remaining = OVERFLOWING.contentWidth - OVERFLOWING.trayWidth
    expect(swatchTrayFadeGates({ ...OVERFLOWING, scrollX: remaining - FADE_GATE_PX })).toEqual({
      hasScrolledPast: true,
      hasMoreToScroll: false,
    })
    expect(
      swatchTrayFadeGates({
        ...OVERFLOWING,
        scrollX: remaining - FADE_GATE_PX - 0.01,
      }),
    ).toEqual({
      hasScrolledPast: true,
      hasMoreToScroll: true,
    })
  })
})
