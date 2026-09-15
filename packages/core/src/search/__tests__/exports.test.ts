import * as core from '../../index'

describe('search package exports', () => {
  it('exposes the search hook and the USFM helper', () => {
    expect(core.useSearch).toEqual(expect.any(Function))
    expect(core.bibleReferenceFromUsfm).toEqual(expect.any(Function))
    expect(core.SEARCH_USER_INTENT).toEqual({
      reference: 'reference',
      text: 'text',
      topical: 'topical',
      unknown: 'unknown',
    })
  })

  it('keeps the client wrapper and the Result seam internal', () => {
    const names = Object.keys(core)
    expect(names).not.toContain('createSearchApi')
    expect(names).not.toContain('ok')
    expect(names).not.toContain('err')
  })
})
