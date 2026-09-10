import {
  adjacentBookChapter,
  catalogFromBooksBody,
  chapterLabelForBook,
  entryFromBooksCatalog,
  type BookCatalogEntry,
} from '../bible-book-title'

const INTRO = { id: 'INTRO', title: 'Introduction' }

/** A catalog row, optionally led by the intro entry the way the API sends it. */
function book(
  title: string,
  chapterCount: number,
  options?: { intro?: boolean },
): BookCatalogEntry {
  const chapters = Array.from({ length: chapterCount }, (_, index) => ({
    id: String(index + 1),
    title: String(index + 1),
  }))
  if (options?.intro === true) {
    return { title, chapters: [INTRO, ...chapters], intro: INTRO }
  }
  return { title, chapters, intro: null }
}

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

    expect(catalog?.get('JHN')).toEqual({
      title: 'John',
      chapters: [
        { id: '1', title: '1' },
        { id: '2', title: '2' },
      ],
      intro: null,
    })
    expect(catalog?.get('HEB')).toEqual({ title: 'Hebrews', chapters: null, intro: null })
  })

  it('keeps chapter titles and the intro entry', () => {
    const catalog = catalogFromBooksBody(
      JSON.stringify([
        {
          id: 'GEN',
          title: 'Genesis',
          intro: { id: 'INTRO', passage_id: 'GEN.INTRO', title: 'Introduction' },
          chapters: [
            { id: 'INTRO', title: 'Introduction' },
            { id: '1', title: '1' },
          ],
        },
      ]),
    )

    expect(catalog?.get('GEN')).toEqual({
      title: 'Genesis',
      chapters: [INTRO, { id: '1', title: '1' }],
      intro: INTRO,
    })
  })

  it('reads a bare array and usfm keys', () => {
    const catalog = catalogFromBooksBody(JSON.stringify([{ usfm: 'GEN', title: 'Genesis' }]))

    expect(catalog?.get('GEN')).toEqual({ title: 'Genesis', chapters: null, intro: null })
  })

  it('returns null for junk', () => {
    expect(catalogFromBooksBody('not-json')).toBeNull()
    expect(catalogFromBooksBody('{}')).toBeNull()
    expect(catalogFromBooksBody(JSON.stringify({ data: { title: 'John' } }))).toBeNull()
  })
})

describe('entryFromBooksCatalog', () => {
  const catalog = new Map([
    ['JHN', book('John', 21)],
    ['HEB', book('Hebrews', 13)],
  ])

  it('finds the selected book', () => {
    expect(entryFromBooksCatalog(catalog, 'JHN')?.title).toBe('John')
    expect(entryFromBooksCatalog(catalog, 'jhn')?.title).toBe('John')
  })

  it('returns null when the book is missing', () => {
    expect(entryFromBooksCatalog(catalog, 'REV')).toBeNull()
    expect(entryFromBooksCatalog(null, 'JHN')).toBeNull()
  })
})

describe('chapterLabelForBook', () => {
  it('names the intro instead of showing its id', () => {
    expect(chapterLabelForBook(book('Genesis', 50, { intro: true }), 'INTRO')).toBe('Introduction')
  })

  it('uses the catalog chapter title', () => {
    const psalms: BookCatalogEntry = {
      title: 'Psalms',
      chapters: [{ id: '119', title: 'Psalm 119' }],
      intro: null,
    }

    expect(chapterLabelForBook(psalms, '119')).toBe('Psalm 119')
  })

  it('falls back to the raw chapter', () => {
    expect(chapterLabelForBook(book('John', 21), '99')).toBe('99')
    expect(chapterLabelForBook(null, '1')).toBe('1')
  })
})

describe('adjacentBookChapter', () => {
  const catalog = new Map([
    ['JHN', book('John', 2)],
    ['ACT', book('Acts', 3)],
    ['ROM', book('Romans', 1)],
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

  it('resolves a lowercase book id', () => {
    expect(adjacentBookChapter(catalog, 'jhn', '1', 'next')).toEqual({
      bookId: 'JHN',
      chapterId: '2',
    })
  })

  it('still steps back a chapter before the catalog lands', () => {
    expect(adjacentBookChapter(null, 'JHN', '3', 'previous')).toEqual({
      bookId: 'JHN',
      chapterId: '2',
    })
    expect(adjacentBookChapter(null, 'JHN', '1', 'previous')).toBeNull()
    expect(adjacentBookChapter(null, 'JHN', '1', 'next')).toBeNull()
    expect(adjacentBookChapter(null, 'JHN', 'INTRO', 'previous')).toBeNull()
  })

  it('does not cross into a book with no chapter list', () => {
    const withGap = new Map([
      ['JHN', book('John', 2)],
      ['HEB', { title: 'Hebrews', chapters: null, intro: null }],
    ])

    expect(adjacentBookChapter(withGap, 'JHN', '2', 'next')).toBeNull()
  })

  describe('intro chapters', () => {
    const withIntros = new Map([
      ['JHN', book('John', 2, { intro: true })],
      ['ACT', book('Acts', 3, { intro: true })],
    ])

    it('does not count the intro as a chapter', () => {
      expect(adjacentBookChapter(withIntros, 'JHN', '2', 'next')).toEqual({
        bookId: 'ACT',
        chapterId: '1',
      })
    })

    it('leaves the intro for the first canonical chapter', () => {
      expect(adjacentBookChapter(withIntros, 'JHN', 'INTRO', 'next')).toEqual({
        bookId: 'JHN',
        chapterId: '1',
      })
    })

    it('opens the previous book from the intro', () => {
      expect(adjacentBookChapter(withIntros, 'ACT', 'INTRO', 'previous')).toEqual({
        bookId: 'JHN',
        chapterId: '2',
      })
    })

    it('steps back into the intro from chapter 1', () => {
      expect(adjacentBookChapter(withIntros, 'ACT', '1', 'previous')).toEqual({
        bookId: 'ACT',
        chapterId: 'INTRO',
      })
    })

    it('skips the next book intro when crossing forward', () => {
      expect(adjacentBookChapter(withIntros, 'JHN', '2', 'next')).not.toEqual({
        bookId: 'ACT',
        chapterId: 'INTRO',
      })
    })
  })
})
