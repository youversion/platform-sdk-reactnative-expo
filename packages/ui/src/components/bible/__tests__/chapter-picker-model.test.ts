import type { BookCatalogEntry } from '../../../lib/bible-book-title'
import {
  booksFromCatalog,
  visibleChapterPickerBooks,
  type ChapterPickerBook,
} from '../chapter-picker-model'

const INTRO = { id: 'INTRO', title: 'Introduction' }

function entry(
  title: string,
  chapters: readonly { id: string; title: string }[] = [{ id: '1', title: '1' }],
  intro: BookCatalogEntry['intro'] = null,
): BookCatalogEntry {
  return { title, chapters, intro }
}

const BOOKS: readonly ChapterPickerBook[] = [
  { id: 'JHN', title: 'John', chapters: [{ id: '1', title: '1' }], intro: null },
  { id: 'GEN', title: 'Genesis', chapters: [{ id: '1', title: '1' }], intro: null },
  { id: 'EXO', title: 'Éxodo', chapters: [{ id: '1', title: '1' }], intro: null },
]

describe('booksFromCatalog', () => {
  it('preserves API order and removes the separately rendered intro from chapters', () => {
    const catalog = new Map([
      ['HEB', entry('Hebrews')],
      ['GEN', entry('Genesis', [INTRO, { id: '1', title: '1' }], INTRO)],
    ])

    expect(booksFromCatalog(catalog)).toEqual([
      { id: 'HEB', ...entry('Hebrews') },
      { id: 'GEN', ...entry('Genesis', [{ id: '1', title: '1' }], INTRO) },
    ])
  })
})

describe('visibleChapterPickerBooks', () => {
  it('keeps API order in traditional mode', () => {
    expect(
      visibleChapterPickerBooks(BOOKS, '', 'traditional', 'en').map((book) => book.id),
    ).toEqual(['JHN', 'GEN', 'EXO'])
  })

  it('uses locale-aware titles in alphabetical mode', () => {
    expect(
      visibleChapterPickerBooks(BOOKS, '', 'alphabetical', 'es').map((book) => book.title),
    ).toEqual(['Éxodo', 'Genesis', 'John'])
  })

  it('matches a one-character query by substring without fuzzy expansion', () => {
    expect(
      visibleChapterPickerBooks(BOOKS, 'x', 'traditional', 'en').map((book) => book.id),
    ).toEqual(['EXO'])
  })

  it('matches longer misspellings and ignores diacritics without changing selected order', () => {
    expect(
      visibleChapterPickerBooks(BOOKS, 'Gensis', 'traditional', 'en').map((book) => book.id),
    ).toEqual(['GEN'])
    expect(
      visibleChapterPickerBooks(BOOKS, 'exodo', 'traditional', 'es').map((book) => book.id),
    ).toEqual(['EXO'])
  })

  it('trims the query and returns no unrelated fuzzy results', () => {
    expect(visibleChapterPickerBooks(BOOKS, '  John  ', 'traditional', 'en')).toEqual([BOOKS[0]])
    expect(visibleChapterPickerBooks(BOOKS, 'completely unrelated', 'traditional', 'en')).toEqual(
      [],
    )
  })
})
