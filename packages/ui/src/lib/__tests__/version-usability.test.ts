import {
  languageTagsWithUsableVersions,
  versionGate,
  type VersionGate,
  type VersionLookup,
} from '../version-usability'
import type { InternalVersionFilterProps } from '../version-filter-props'

const SETTLED_EN: VersionLookup = { languageId: 'en', isLoading: false, error: null }
const LOADING: VersionLookup = { languageId: null, isLoading: true, error: null }
const OFFLINE: VersionLookup = { languageId: null, isLoading: false, error: 'offline' }

describe('versionGate', () => {
  it.each<[string, InternalVersionFilterProps, VersionLookup, VersionGate]>([
    ['no filters', {}, LOADING, 'open'],
    ['an excluded id, before the lookup lands', { excludedVersionIds: [7] }, LOADING, 'refused'],
    ['an id outside the permit list', { permittedVersionIds: [1] }, SETTLED_EN, 'refused'],
    [
      'a language list while the lookup loads',
      { permittedLanguageTags: ['en'] },
      LOADING,
      'checking',
    ],
    [
      'a language list after the lookup failed',
      { permittedLanguageTags: ['en'] },
      OFFLINE,
      'lookupFailed',
    ],
    ['a permitted language', { permittedLanguageTags: ['en'] }, SETTLED_EN, 'open'],
    ['an unlisted language', { permittedLanguageTags: ['es'] }, SETTLED_EN, 'refused'],
    [
      'a version with no language tag',
      { permittedLanguageTags: ['en'] },
      { languageId: null, isLoading: false, error: null },
      'refused',
    ],
  ])('%s', (_label, filters, lookup, expected) => {
    expect(versionGate(7, filters, lookup)).toBe(expected)
  })
})

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
