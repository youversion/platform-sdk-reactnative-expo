import { languageTagsWithUsableVersions } from '../version-usability'

const TAGS = new Map<number, string>([
  [1, 'en'],
  [2, 'en'],
  [3, 'es'],
  [4, 'fr'],
  [5, ''],
])

describe('languageTagsWithUsableVersions', () => {
  it('keeps every language that has a version when no filters are set', () => {
    expect([...languageTagsWithUsableVersions(TAGS, {})].sort()).toEqual(['en', 'es', 'fr'])
  })

  it('drops a language whose versions are all excluded', () => {
    const allowed = languageTagsWithUsableVersions(TAGS, { excludedVersionIds: [3] })

    expect(allowed.has('es')).toBe(false)
    expect(allowed.has('en')).toBe(true)
    expect(allowed.has('fr')).toBe(true)
  })

  it('keeps a language when one of its versions stays permitted', () => {
    const allowed = languageTagsWithUsableVersions(TAGS, { permittedVersionIds: [2, 4] })

    expect([...allowed].sort()).toEqual(['en', 'fr'])
  })

  it('drops languages outside the permitted language tags', () => {
    const allowed = languageTagsWithUsableVersions(TAGS, { permittedLanguageTags: ['es'] })

    expect([...allowed]).toEqual(['es'])
  })

  it('drops a permitted language when every version in it is excluded', () => {
    const allowed = languageTagsWithUsableVersions(TAGS, {
      permittedLanguageTags: ['en', 'es'],
      excludedVersionIds: [1, 2],
    })

    expect(allowed.has('en')).toBe(false)
    expect(allowed.has('es')).toBe(true)
  })
})
