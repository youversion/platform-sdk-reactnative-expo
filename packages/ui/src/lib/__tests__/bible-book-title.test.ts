import { adjacentBookChapter, catalogFromBooksBody, entryFromBooksCatalog } from '../bible-book-title'

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

describe('adjacentBookChapter', () => {
  const catalog = new Map([
    ['JHN', { title: 'John', chapterCount: 2 }],
    ['ACT', { title: 'Acts', chapterCount: 3 }],
    ['ROM', { title: 'Romans', chapterCount: 1 }],
  ])

  it('steps within the current book', () => {
    expect(adjacentBookChapter(catalog, 'JHN', '1', 'next')).toEqual({
      bookId: 'JHN',
      chapterId: '2',
    })
    expect(adjacentBookChapter(catalog, 'ACT', '3', 'previous')).toEqual({
      bookId: 'ACT',
      chapterId: '2',
    })
  })

  it('opens the next book from the last chapter', () => {
    expect(adjacentBookChapter(catalog, 'JHN', '2', 'next')).toEqual({
      bookId: 'ACT',
      chapterId: '1',
    })
  })

  it('opens the previous book from chapter 1', () => {
    expect(adjacentBookChapter(catalog, 'ACT', '1', 'previous')).toEqual({
      bookId: 'JHN',
      chapterId: '2',
    })
  })

  it('stays off at the ends of the list', () => {
    expect(adjacentBookChapter(catalog, 'JHN', '1', 'previous')).toBeNull()
    expect(adjacentBookChapter(catalog, 'ROM', '1', 'next')).toBeNull()
  })

  it('still steps back a chapter before the catalog lands', () => {
    expect(adjacentBookChapter(null, 'JHN', '3', 'previous')).toEqual({
      bookId: 'JHN',
      chapterId: '2',
    })
    expect(adjacentBookChapter(null, 'JHN', '1', 'previous')).toBeNull()
    expect(adjacentBookChapter(null, 'JHN', '1', 'next')).toBeNull()
  })

  it('does not cross into a book with no chapter list', () => {
    const withGap = new Map([
      ['JHN', { title: 'John', chapterCount: 2 }],
      ['HEB', { title: 'Hebrews', chapterCount: null }],
    ])

    expect(adjacentBookChapter(withGap, 'JHN', '2', 'next')).toBeNull()
  })
})
