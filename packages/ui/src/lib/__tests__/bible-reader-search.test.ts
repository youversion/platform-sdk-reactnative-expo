import {
  dedupeVerseUsfms,
  languageRangesForVersionLanguage,
  nonBlankQuery,
  pageTokenOf,
  SEARCH_QUERY_MAX_LENGTH,
  shouldPrefetchNextPage,
  titledVerseFromPassage,
  trimSnippet,
  usfmsFromSearchHits,
  verseContentPath,
  type Usfm,
} from '../bible-reader-search'

function usfm(value: string): Usfm {
  // SAFETY: test fixture USFMs are well-formed ids; the brand is a compile-time marker.
  return value as Usfm
}

describe('bible reader search helpers', () => {
  it('uses the Bible version language tag, or * when it is missing', () => {
    expect(languageRangesForVersionLanguage('es')).toEqual(['es'])
    expect(languageRangesForVersionLanguage(undefined)).toEqual(['*'])
    expect(languageRangesForVersionLanguage(null)).toEqual(['*'])
    expect(languageRangesForVersionLanguage('')).toEqual(['*'])
  })

  it('clips a branded query at 100 characters and trims it', () => {
    expect(nonBlankQuery('a'.repeat(SEARCH_QUERY_MAX_LENGTH + 8))).toHaveLength(
      SEARCH_QUERY_MAX_LENGTH,
    )
    expect(nonBlankQuery('  love  ')).toBe('love')
  })

  it('refuses a blank query', () => {
    expect(nonBlankQuery('   ')).toBeNull()
    expect(nonBlankQuery('')).toBeNull()
  })

  it('brands usfms off the search hits', () => {
    expect(usfmsFromSearchHits([{ id: 'JHN.3.16' }, { id: 'PSA.23' }])).toEqual([
      'JHN.3.16',
      'PSA.23',
    ])
  })

  it('treats a missing or empty page cursor as no next page', () => {
    expect(pageTokenOf('page-2')).toBe('page-2')
    expect(pageTokenOf('')).toBeNull()
    expect(pageTokenOf(null)).toBeNull()
    expect(pageTokenOf(undefined)).toBeNull()
  })

  it('dedupes incoming verses against the usfms already seen', () => {
    expect(
      dedupeVerseUsfms(new Set([usfm('JHN.3.16')]), [
        usfm('JHN.3.16'),
        usfm('JHN.3.17'),
        usfm('ROM.8.1'),
      ]),
    ).toEqual(['JHN.3.17', 'ROM.8.1'])
  })

  it('builds the passage path for enrichment', () => {
    expect(verseContentPath(111, usfm('JHN.3.16'))).toBe(
      '/v1/bibles/111/passages/JHN.3.16?format=text',
    )
  })

  it('prefetches once a row in the last five is visible', () => {
    expect(shouldPrefetchNextPage(4, 10)).toBe(false)
    expect(shouldPrefetchNextPage(5, 10)).toBe(true)
    expect(shouldPrefetchNextPage(0, 3)).toBe(true)
    expect(shouldPrefetchNextPage(-1, 10)).toBe(false)
  })

  it('collapses whitespace in a snippet', () => {
    expect(trimSnippet('  For   God\nso loved  ')).toBe('For God so loved')
  })

  it('titles a verse from a passage body and drops the HTML', () => {
    expect(
      titledVerseFromPassage(
        usfm('JHN.3.16'),
        '{"content":"<p>For God so loved</p>","reference":"John 3:16"}',
      ),
    ).toEqual({ usfm: 'JHN.3.16', title: 'John 3:16', snippet: 'For God so loved' })
  })

  it('refuses a passage with no usable title or snippet', () => {
    expect(titledVerseFromPassage(usfm('JHN.3.16'), 'not-json')).toBeNull()
    expect(
      titledVerseFromPassage(usfm('JHN.3.16'), '{"content":"   ","reference":"John 3:16"}'),
    ).toBeNull()
    expect(
      titledVerseFromPassage(usfm('JHN.3.16'), '{"content":"For God so loved","reference":"  "}'),
    ).toBeNull()
  })
})
