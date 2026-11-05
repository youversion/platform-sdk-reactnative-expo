import * as core from '../../index'
import type { SearchImagesParams, YouVersionImageSearchResults } from '../../index'

describe('search package exports', () => {
  it('exposes the search hook and the passage anchor helper', () => {
    expect(core.useSearch).toEqual(expect.any(Function))
    expect(core.useUnifiedSearch).toEqual(expect.any(Function))
    expect(core.biblePassageAnchorFromPassageId).toEqual(expect.any(Function))
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
    expect(names).not.toContain('searchUnified')
    expect(names).not.toContain('ApiClient')
    expect(names).not.toContain('ok')
    expect(names).not.toContain('err')
  })

  it('exports paged image search results', () => {
    const params = {
      query: 'love',
      bibleId: 111,
      pageSize: 10,
      pageToken: '',
    } satisfies SearchImagesParams
    const page = {
      images: [{ id: 'opaque+/=id', passageId: '1CO.13.4-7' }],
      nextPageToken: '',
    } satisfies YouVersionImageSearchResults

    expect(params.pageToken).toBe('')
    expect(page.images[0]?.id).toBe('opaque+/=id')
    expect(page.nextPageToken).toBe('')
  })
})
