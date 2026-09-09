import { abbreviationFromVersionBody } from '../bible-version-abbreviation'

describe('abbreviationFromVersionBody', () => {
  it('prefers local_abbreviation', () => {
    expect(
      abbreviationFromVersionBody(
        JSON.stringify({ abbreviation: 'NIV', local_abbreviation: 'NVI' }),
      ),
    ).toBe('NVI')
  })

  it('uses abbreviation when the localized field is missing', () => {
    expect(abbreviationFromVersionBody(JSON.stringify({ abbreviation: 'BSB' }))).toBe('BSB')
  })

  it('reads a nested data object', () => {
    expect(
      abbreviationFromVersionBody(JSON.stringify({ data: { abbreviation: 'KJV' } })),
    ).toBe('KJV')
  })

  it('returns null for junk', () => {
    expect(abbreviationFromVersionBody('not-json')).toBeNull()
    expect(abbreviationFromVersionBody('{}')).toBeNull()
    expect(abbreviationFromVersionBody(JSON.stringify({ abbreviation: '  ' }))).toBeNull()
  })
})
