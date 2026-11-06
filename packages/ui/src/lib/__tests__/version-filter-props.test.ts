import { sameVersionFilters } from '../version-filter-props'

describe('sameVersionFilters', () => {
  it('treats two empty filter sets as the same', () => {
    expect(sameVersionFilters({}, {})).toBe(true)
  })

  it('compares lists by value, not identity', () => {
    expect(
      sameVersionFilters(
        { permittedVersionIds: [1, 2], excludedVersionIds: [3], permittedLanguageTags: ['en'] },
        { permittedVersionIds: [1, 2], excludedVersionIds: [3], permittedLanguageTags: ['en'] },
      ),
    ).toBe(true)
  })

  it('treats a missing list and an empty list as different', () => {
    expect(sameVersionFilters({ permittedVersionIds: [] }, {})).toBe(false)
  })

  it('treats a shorter list as different from a longer list with the same prefix', () => {
    expect(sameVersionFilters({ permittedVersionIds: [1] }, { permittedVersionIds: [1, 2] })).toBe(
      false,
    )
  })

  it('treats the same items in a different order as different', () => {
    expect(sameVersionFilters({ excludedVersionIds: [1, 2] }, { excludedVersionIds: [2, 1] })).toBe(
      false,
    )
  })

  it('notices a change in any one of the three lists', () => {
    const base = {
      permittedVersionIds: [1],
      excludedVersionIds: [2],
      permittedLanguageTags: ['en'],
    }

    expect(sameVersionFilters(base, { ...base, permittedVersionIds: [9] })).toBe(false)
    expect(sameVersionFilters(base, { ...base, excludedVersionIds: [9] })).toBe(false)
    expect(sameVersionFilters(base, { ...base, permittedLanguageTags: ['es'] })).toBe(false)
  })
})
