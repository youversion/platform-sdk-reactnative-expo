import { filterLanguagesBySearch, filterVersions } from '../filter-versions'

const FIXTURE = [
  { id: 1, title: 'Alpha Bible', abbreviation: 'ALP', languageTag: 'en' },
  { id: 2, title: 'Beta Bible', abbreviation: 'BET', languageTag: 'es' },
  { id: 3, title: 'Gamma Bible', abbreviation: 'GAM', languageTag: 'en' },
  { id: 4, title: 'Delta Bible', abbreviation: 'DEL', languageTag: 'fr' },
]

describe('filterVersions', () => {
  it('filters by language, search term, and recent ids', () => {
    const byLanguageAndRecent = filterVersions(FIXTURE, '', 'en', [3])
    const bySearch = filterVersions(FIXTURE, 'alpha', 'en', [])

    expect(byLanguageAndRecent.map((version) => version.id)).toEqual([1])
    expect(bySearch.map((version) => version.id)).toEqual([1])
  })
})

describe('filterLanguagesBySearch', () => {
  it('keeps a language whose id or English name contains the query', () => {
    const languages = [
      { id: 'en', displayNames: { en: 'English' } },
      { id: 'es', displayNames: { en: 'Spanish' } },
    ]

    expect(filterLanguagesBySearch(languages, 'span').map((language) => language.id)).toEqual(['es'])
    expect(filterLanguagesBySearch(languages, '').map((language) => language.id)).toEqual(['en', 'es'])
  })
})
