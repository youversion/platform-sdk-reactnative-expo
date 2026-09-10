import {
  clipSearchQuery,
  dedupeVerseUsfms,
  formatUsfmLabel,
  languageRangesForLocale,
  parsePassageSnippet,
  SEARCH_QUERY_MAX_LENGTH,
  shouldRequestNextPage,
  trimSnippet,
  verseContentPath,
} from '../bible-reader-search'

describe('bible reader search helpers', () => {
  it('uses the provider locale, or * when it is missing', () => {
    expect(languageRangesForLocale('es')).toEqual(['es'])
    expect(languageRangesForLocale(undefined)).toEqual(['*'])
    expect(languageRangesForLocale('')).toEqual(['*'])
  })

  it('clips the query at 100 characters', () => {
    const long = 'a'.repeat(SEARCH_QUERY_MAX_LENGTH + 8)
    expect(clipSearchQuery(long)).toHaveLength(SEARCH_QUERY_MAX_LENGTH)
    expect(clipSearchQuery('love')).toBe('love')
  })

  it('formats USFM as a short label and leaves malformed ids alone', () => {
    expect(formatUsfmLabel('JHN.3.16')).toBe('JHN 3:16')
    expect(formatUsfmLabel('JHN.3')).toBe('JHN.3')
  })

  it('paginates once a row in the last five is visible', () => {
    expect(shouldRequestNextPage(5, 10)).toBe(true)
    expect(shouldRequestNextPage(4, 10)).toBe(false)
    expect(shouldRequestNextPage(0, 0)).toBe(false)
  })

  it('dedupes incoming verses by USFM', () => {
    expect(dedupeVerseUsfms(['JHN.3.16'], ['JHN.3.16', 'JHN.3.17', 'ROM.8.1'])).toEqual([
      'JHN.3.17',
      'ROM.8.1',
    ])
  })

  it('builds the passage path for enrichment', () => {
    expect(verseContentPath(111, 'JHN.3.16')).toBe('/v1/bibles/111/passages/JHN.3.16?format=text')
  })

  it('trims snippets and drops HTML', () => {
    expect(trimSnippet('  For   God\nso loved  ')).toBe('For God so loved')
    expect(
      parsePassageSnippet('{"content":"<p>For God so loved</p>","reference":"John 3:16"}'),
    ).toEqual({
      snippet: 'For God so loved',
      title: 'John 3:16',
    })
    expect(parsePassageSnippet('not-json')).toBeNull()
  })
})
