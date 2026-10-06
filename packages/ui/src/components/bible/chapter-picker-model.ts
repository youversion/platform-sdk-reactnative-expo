import Fuse from 'fuse.js'

import type { BookCatalogEntry } from '../../lib/bible-book-title'

export type ChapterPickerOrder = 'traditional' | 'alphabetical'

export type ChapterPickerBook = Omit<BookCatalogEntry, 'chapters'> & {
  id: string
  chapters: readonly NonNullable<BookCatalogEntry['chapters']>[number][]
}

export function booksFromCatalog(
  catalog: ReadonlyMap<string, BookCatalogEntry>,
): readonly ChapterPickerBook[] {
  return [...catalog].map(([id, entry]) => ({
    id,
    ...entry,
    chapters: entry.chapters?.filter((chapter) => chapter.id !== entry.intro?.id) ?? [],
  }))
}

export function visibleChapterPickerBooks(
  books: readonly ChapterPickerBook[],
  query: string,
  order: ChapterPickerOrder,
  locale: string,
): readonly ChapterPickerBook[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' })
  let ordered: readonly ChapterPickerBook[] = books
  if (order === 'alphabetical') {
    ordered = [...books].sort((a, b) => collator.compare(a.title, b.title))
  }
  const normalizedQuery = query.trim()
  if (normalizedQuery === '') {
    return ordered
  }
  if (Array.from(normalizedQuery).length === 1) {
    const needle = normalizedQuery.toLocaleLowerCase(locale)
    return ordered.filter((book) => book.title.toLocaleLowerCase(locale).includes(needle))
  }

  const matches = new Set(
    new Fuse(books, {
      keys: ['title'],
      threshold: 0.35,
      ignoreDiacritics: true,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })
      .search(normalizedQuery)
      .map(({ item }) => item.id),
  )
  return ordered.filter((book) => matches.has(book.id))
}
