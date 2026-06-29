import { withEmbedDomDefaults, withSheetDomDefaults } from '../embed-dom-props'

const SCROLL_CHROME = {
  scrollEnabled: false,
  bounces: false,
  overScrollMode: 'never',
  showsVerticalScrollIndicator: false,
  showsHorizontalScrollIndicator: false,
} as const

const EMBED_DEFAULTS = {
  matchContents: true,
  containerStyle: { flex: 0, width: '100%' },
  ...SCROLL_CHROME,
}

const SHEET_DEFAULTS = {
  matchContents: true,
  ...SCROLL_CHROME,
}

describe('withEmbedDomDefaults', () => {
  it('enables matchContents, the embed container style, and no scrolling when no dom prop is given', () => {
    expect(withEmbedDomDefaults()).toEqual(EMBED_DEFAULTS)
  })

  it('preserves unrelated consumer dom props', () => {
    const onMessage = jest.fn()
    expect(withEmbedDomDefaults({ injectedJavaScript: 'true;', onMessage })).toEqual({
      ...EMBED_DEFAULTS,
      injectedJavaScript: 'true;',
      onMessage,
    })
  })

  it('lets the consumer re-enable scrolling', () => {
    expect(withEmbedDomDefaults({ scrollEnabled: true, bounces: true })).toEqual({
      ...EMBED_DEFAULTS,
      scrollEnabled: true,
      bounces: true,
    })
  })

  it('merges a consumer containerStyle after the embed defaults so it wins per-key', () => {
    expect(withEmbedDomDefaults({ containerStyle: { width: 300 } })).toEqual({
      ...EMBED_DEFAULTS,
      containerStyle: [{ flex: 0, width: '100%' }, { width: 300 }],
    })
  })

  it('applies no container or scroll defaults when the consumer opts out of matchContents', () => {
    expect(withEmbedDomDefaults({ matchContents: false, injectedJavaScript: 'true;' })).toEqual({
      matchContents: false,
      injectedJavaScript: 'true;',
    })
  })

  it('keeps an explicit matchContents: true equivalent to the default', () => {
    expect(withEmbedDomDefaults({ matchContents: true })).toEqual(withEmbedDomDefaults())
  })
})

describe('withSheetDomDefaults', () => {
  it('enables matchContents and scroll-chrome defaults when no dom prop is given', () => {
    expect(withSheetDomDefaults()).toEqual(SHEET_DEFAULTS)
  })

  it('does not apply embed containerStyle', () => {
    expect(withSheetDomDefaults().containerStyle).toBeUndefined()
  })

  it('lets the consumer override scroll-chrome defaults', () => {
    expect(
      withSheetDomDefaults({ showsVerticalScrollIndicator: true, injectedJavaScript: 'true;' }),
    ).toEqual({
      ...SHEET_DEFAULTS,
      showsVerticalScrollIndicator: true,
      injectedJavaScript: 'true;',
    })
  })

  it('keeps an explicit matchContents: false when the consumer opts out', () => {
    expect(withSheetDomDefaults({ matchContents: false })).toEqual({
      ...SCROLL_CHROME,
      matchContents: false,
    })
  })
})
