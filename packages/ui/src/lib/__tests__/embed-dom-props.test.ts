import { withEmbedDomDefaults } from '../embed-dom-props'

describe('withEmbedDomDefaults', () => {
  it('enables matchContents and the embed container style when no dom prop is given', () => {
    expect(withEmbedDomDefaults()).toEqual({
      matchContents: true,
      containerStyle: { flex: 0, width: '100%' },
    })
  })

  it('preserves unrelated consumer dom props', () => {
    const onMessage = jest.fn()
    expect(withEmbedDomDefaults({ scrollEnabled: false, onMessage })).toEqual({
      scrollEnabled: false,
      onMessage,
      matchContents: true,
      containerStyle: { flex: 0, width: '100%' },
    })
  })

  it('merges a consumer containerStyle after the embed defaults so it wins per-key', () => {
    expect(withEmbedDomDefaults({ containerStyle: { width: 300 } })).toEqual({
      matchContents: true,
      containerStyle: [{ flex: 0, width: '100%' }, { width: 300 }],
    })
  })

  it('applies no container defaults when the consumer opts out of matchContents', () => {
    expect(withEmbedDomDefaults({ matchContents: false, scrollEnabled: true })).toEqual({
      matchContents: false,
      scrollEnabled: true,
    })
  })

  it('keeps an explicit matchContents: true equivalent to the default', () => {
    expect(withEmbedDomDefaults({ matchContents: true })).toEqual(withEmbedDomDefaults())
  })
})
