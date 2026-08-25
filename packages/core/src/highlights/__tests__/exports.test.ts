/**
 * Guards the public API surface: `useHighlights` and the projection helper must
 * be reachable from the package index, while the API wrapper, the MMKV cache,
 * and the `Result` seam must not be — those are internals a consumer coupling to
 * would pin us out of the S1 library decision.
 */
import * as core from '../../index'

describe('package exports', () => {
  it('exposes the highlights hook and the palette', () => {
    expect(core.useHighlights).toEqual(expect.any(Function))
    expect(core.deriveServerColors).toEqual(expect.any(Function))
    expect(core.parseChapterScopeFromUsfm).toEqual(expect.any(Function))
    expect(core.useHighlightPaint).toEqual(expect.any(Function))
    expect(core.isHighlightColor).toEqual(expect.any(Function))
    expect(core.HIGHLIGHT_COLORS).toEqual(['fffe00', '5dff79', '00d6ff', 'ffc66f', 'ff95ef'])
  })

  it('keeps the client wrapper, the cache, and the Result seam internal', () => {
    const names = Object.keys(core)
    expect(names).not.toContain('createHighlightsApi')
    expect(names).not.toContain('getVerseOfTheDayPassageId')
    expect(names).not.toContain('useVerseOfTheDayPassageId')
    expect(names).not.toContain('getCachedHighlights')
    expect(names).not.toContain('listCachedHighlights')
    expect(names).not.toContain('setCachedHighlights')
    expect(names).not.toContain('clearHighlightsCache')
    expect(names).not.toContain('clearHighlightQueue')
    expect(names).not.toContain('isValidHighlightHex')
    expect(names).not.toContain('ok')
    expect(names).not.toContain('err')
  })
})
