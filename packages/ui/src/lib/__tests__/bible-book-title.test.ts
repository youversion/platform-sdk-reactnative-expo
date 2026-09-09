import { titleFromBooksCatalog, titlesFromBooksBody } from '../bible-book-title'

describe('titlesFromBooksBody', () => {
  it('reads a data array', () => {
    const titles = titlesFromBooksBody(
      JSON.stringify({
        data: [
          { id: 'JHN', title: 'John' },
          { id: 'HEB', title: 'Hebrews' },
        ],
      }),
    )

    expect(titles?.get('JHN')).toBe('John')
    expect(titles?.get('HEB')).toBe('Hebrews')
  })

  it('reads a bare array and usfm keys', () => {
    const titles = titlesFromBooksBody(JSON.stringify([{ usfm: 'GEN', title: 'Genesis' }]))

    expect(titles?.get('GEN')).toBe('Genesis')
  })

  it('returns null for junk', () => {
    expect(titlesFromBooksBody('not-json')).toBeNull()
    expect(titlesFromBooksBody('{}')).toBeNull()
    expect(titlesFromBooksBody(JSON.stringify({ data: { title: 'John' } }))).toBeNull()
  })
})

describe('titleFromBooksCatalog', () => {
  const titles = new Map([
    ['JHN', 'John'],
    ['HEB', 'Hebrews'],
  ])

  it('finds the selected book', () => {
    expect(titleFromBooksCatalog(titles, 'JHN')).toBe('John')
    expect(titleFromBooksCatalog(titles, 'jhn')).toBe('John')
  })

  it('returns null when the book is missing', () => {
    expect(titleFromBooksCatalog(titles, 'REV')).toBeNull()
    expect(titleFromBooksCatalog(null, 'JHN')).toBeNull()
  })
})
