import { catalogFromBooksBody, entryFromBooksCatalog } from '../bible-book-title'

describe('catalogFromBooksBody', () => {
  it('reads a data array', () => {
    const catalog = catalogFromBooksBody(
      JSON.stringify({
        data: [
          { id: 'JHN', title: 'John', chapters: [{ id: '1' }, { id: '2' }] },
          { id: 'HEB', title: 'Hebrews' },
        ],
      }),
    )

    expect(catalog?.get('JHN')).toEqual({ title: 'John', chapterCount: 2 })
    expect(catalog?.get('HEB')).toEqual({ title: 'Hebrews', chapterCount: null })
  })

  it('reads a bare array and usfm keys', () => {
    const catalog = catalogFromBooksBody(JSON.stringify([{ usfm: 'GEN', title: 'Genesis' }]))

    expect(catalog?.get('GEN')).toEqual({ title: 'Genesis', chapterCount: null })
  })

  it('returns null for junk', () => {
    expect(catalogFromBooksBody('not-json')).toBeNull()
    expect(catalogFromBooksBody('{}')).toBeNull()
    expect(catalogFromBooksBody(JSON.stringify({ data: { title: 'John' } }))).toBeNull()
  })
})

describe('entryFromBooksCatalog', () => {
  const catalog = new Map([
    ['JHN', { title: 'John', chapterCount: 21 }],
    ['HEB', { title: 'Hebrews', chapterCount: 13 }],
  ])

  it('finds the selected book', () => {
    expect(entryFromBooksCatalog(catalog, 'JHN')).toEqual({ title: 'John', chapterCount: 21 })
    expect(entryFromBooksCatalog(catalog, 'jhn')).toEqual({ title: 'John', chapterCount: 21 })
  })

  it('returns null when the book is missing', () => {
    expect(entryFromBooksCatalog(catalog, 'REV')).toBeNull()
    expect(entryFromBooksCatalog(null, 'JHN')).toBeNull()
  })
})
