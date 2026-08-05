import type { ServerColors } from '@youversion/platform-react-native-expo-core'
import { HIGHLIGHT_COLORS } from '@youversion/platform-react-native-expo-core'

import { buildVerseActionSwatches } from '../verse-action-swatches'

const [YELLOW, GREEN, BLUE, ORANGE, PINK] = HIGHLIGHT_COLORS

/** `['remove:fffe00', 'apply:5dff79', …]` — order matters, so assert it as a list. */
function summarize(input: { verses: number[]; colors: ServerColors }): string[] {
  return buildVerseActionSwatches(input).map(({ state, color }) => `${state}:${color}`)
}

describe('buildVerseActionSwatches', () => {
  it('offers the whole palette for a single unhighlighted verse', () => {
    expect(summarize({ verses: [1], colors: {} })).toEqual([
      `apply:${YELLOW}`,
      `apply:${GREEN}`,
      `apply:${BLUE}`,
      `apply:${ORANGE}`,
      `apply:${PINK}`,
    ])
  })

  it('offers the whole palette for an empty selection', () => {
    // The sheet never opens on an empty selection, but the projection must not
    // depend on that — a `verses: []` payload arrives on every clear.
    expect(summarize({ verses: [], colors: {} })).toHaveLength(5)
  })

  it('drops the applied colour from the apply row for one highlighted verse', () => {
    // One verse, one colour, nothing bare: the only thing to offer is removing
    // it, plus the four colours it could become.
    expect(summarize({ verses: [1], colors: { 1: YELLOW } })).toEqual([
      `remove:${YELLOW}`,
      `apply:${GREEN}`,
      `apply:${BLUE}`,
      `apply:${ORANGE}`,
      `apply:${PINK}`,
    ])
  })

  it('keeps a colour in the apply row when part of the selection is still bare', () => {
    // `unHighlightedCount > 0` — yellow is offered again because applying it
    // would extend it over verse 2.
    expect(summarize({ verses: [1, 2], colors: { 1: YELLOW } })).toEqual([
      `remove:${YELLOW}`,
      `apply:${YELLOW}`,
      `apply:${GREEN}`,
      `apply:${BLUE}`,
      `apply:${ORANGE}`,
      `apply:${PINK}`,
    ])
  })

  it('offers a remove circle per distinct colour present — the ANY rule, not ALL', () => {
    // Web's `activeHighlights`: yellow is on verse 1 only and cyan on verse 2
    // only, yet both get a remove circle. An ALL rule would show neither.
    expect(summarize({ verses: [1, 2], colors: { 1: YELLOW, 2: BLUE } })).toEqual([
      `remove:${YELLOW}`,
      `remove:${BLUE}`,
      `apply:${YELLOW}`,
      `apply:${GREEN}`,
      `apply:${BLUE}`,
      `apply:${ORANGE}`,
      `apply:${PINK}`,
    ])
  })

  it('re-offers every colour once more than one is present, even with nothing bare', () => {
    // `activeHighlights.size > 1` is the other half of `showAllApplyColors`:
    // with two colours in play, "make it all green" is a real action.
    const swatches = summarize({ verses: [1, 2], colors: { 1: YELLOW, 2: GREEN } })
    expect(swatches.filter((s) => s.startsWith('apply:'))).toHaveLength(5)
  })

  it('shows only remove circles when all five colours are present', () => {
    expect(
      summarize({
        verses: [1, 2, 3, 4, 5],
        colors: { 1: YELLOW, 2: GREEN, 3: BLUE, 4: ORANGE, 5: PINK },
      }),
    ).toEqual([
      `remove:${YELLOW}`,
      `remove:${GREEN}`,
      `remove:${BLUE}`,
      `remove:${ORANGE}`,
      `remove:${PINK}`,
    ])
  })

  it('orders remove circles before apply circles, both in canonical palette order', () => {
    // Seeded out of palette order on purpose: the output must not inherit the
    // insertion order of the colours map.
    expect(summarize({ verses: [1, 2], colors: { 1: PINK, 2: BLUE } })).toEqual([
      `remove:${BLUE}`,
      `remove:${PINK}`,
      `apply:${YELLOW}`,
      `apply:${GREEN}`,
      `apply:${BLUE}`,
      `apply:${ORANGE}`,
      `apply:${PINK}`,
    ])
  })

  it('ignores colours outside the five swatches', () => {
    // The WebView paints from a projection that drops these, so counting them
    // would size the tray against paint the user cannot see. Verse 1 therefore
    // reads as bare, which is why yellow stays in the apply row.
    expect(summarize({ verses: [1, 2], colors: { 1: '123456', 2: YELLOW } })).toEqual([
      `remove:${YELLOW}`,
      `apply:${YELLOW}`,
      `apply:${GREEN}`,
      `apply:${BLUE}`,
      `apply:${ORANGE}`,
      `apply:${PINK}`,
    ])
  })

  it('ignores colours on verses outside the selection', () => {
    expect(summarize({ verses: [1], colors: { 1: YELLOW, 9: PINK } })).toEqual([
      `remove:${YELLOW}`,
      `apply:${GREEN}`,
      `apply:${BLUE}`,
      `apply:${ORANGE}`,
      `apply:${PINK}`,
    ])
  })
})
