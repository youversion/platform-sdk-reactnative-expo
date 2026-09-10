import { versionMetaFromBody } from '../bible-version-abbreviation'

describe('versionMetaFromBody', () => {
  it('prefers localized_abbreviation', () => {
    expect(
      versionMetaFromBody(
        JSON.stringify({ abbreviation: 'NIV', localized_abbreviation: 'NVI' }),
      ),
    ).toEqual({ abbreviation: 'NVI', languageId: null })
  })

  it('uses abbreviation when the localized field is missing', () => {
    expect(versionMetaFromBody(JSON.stringify({ abbreviation: 'BSB' }))).toEqual({
      abbreviation: 'BSB',
      languageId: null,
    })
  })

  it('reads language_tag', () => {
    expect(
      versionMetaFromBody(JSON.stringify({ abbreviation: 'NVI', language_tag: 'es' })),
    ).toEqual({ abbreviation: 'NVI', languageId: 'es' })
  })

  it('reads a nested data object', () => {
    expect(
      versionMetaFromBody(JSON.stringify({ data: { abbreviation: 'KJV', language_tag: 'en' } })),
    ).toEqual({ abbreviation: 'KJV', languageId: 'en' })
  })

  it('returns empty fields for junk', () => {
    expect(versionMetaFromBody('not-json')).toEqual({ abbreviation: null, languageId: null })
    expect(versionMetaFromBody('{}')).toEqual({ abbreviation: null, languageId: null })
    expect(versionMetaFromBody(JSON.stringify({ abbreviation: '  ' }))).toEqual({
      abbreviation: null,
      languageId: null,
    })
  })
})
