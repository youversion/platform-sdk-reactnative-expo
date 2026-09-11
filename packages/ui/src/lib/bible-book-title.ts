import { z } from 'zod'

const titleSchema = z.string().trim().min(1)
const bookIdSchema = z.string().trim().min(1)
const bookEntrySchema = z.object({
  id: z.unknown().optional(),
  usfm: z.unknown().optional(),
  title: z.unknown().optional(),
  chapters: z.unknown().optional(),
})
const booksBodySchema = z.object({
  data: z.unknown().optional(),
})

export type BookCatalogEntry = {
  title: string
  chapterCount: number | null
}

function chapterCountForEntry(entry: z.infer<typeof bookEntrySchema>): number | null {
  const chapters = z.array(z.unknown()).safeParse(entry.chapters)
  if (!chapters.success) {
    return null
  }
  return chapters.data.length
}

function entryForBook(entry: z.infer<typeof bookEntrySchema>): { id: string; title: string; chapterCount: number | null } | null {
  const title = titleSchema.safeParse(entry.title)
  if (!title.success) {
    return null
  }
  const chapterCount = chapterCountForEntry(entry)
  const id = bookIdSchema.safeParse(entry.id)
  if (id.success) {
    return { id: id.data, title: title.data, chapterCount }
  }
  const usfm = bookIdSchema.safeParse(entry.usfm)
  if (usfm.success) {
    return { id: usfm.data, title: title.data, chapterCount }
  }
  return null
}

const bookListSchema = z.array(bookEntrySchema)

function catalogFromEntries(entries: z.infer<typeof bookListSchema>): Map<string, BookCatalogEntry> {
  const catalog = new Map<string, BookCatalogEntry>()
  for (const entry of entries) {
    const parsed = entryForBook(entry)
    if (parsed !== null) {
      catalog.set(parsed.id, { title: parsed.title, chapterCount: parsed.chapterCount })
    }
  }
  return catalog
}

/** Reads book id → title and chapter count from a `/v1/bibles/{id}/books` body. */
export function catalogFromBooksBody(body: string): ReadonlyMap<string, BookCatalogEntry> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }

  const asList = bookListSchema.safeParse(parsed)
  if (asList.success) {
    return catalogFromEntries(asList.data)
  }

  const envelope = booksBodySchema.safeParse(parsed)
  if (!envelope.success) {
    return null
  }
  const fromData = bookListSchema.safeParse(envelope.data.data)
  if (!fromData.success) {
    return null
  }
  return catalogFromEntries(fromData.data)
}

export function entryFromBooksCatalog(
  catalog: ReadonlyMap<string, BookCatalogEntry> | null,
  book: string,
): BookCatalogEntry | null {
  if (catalog === null) {
    return null
  }
  const exact = catalog.get(book)
  if (exact !== undefined) {
    return exact
  }
  return catalog.get(book.toUpperCase()) ?? null
}

export type AdjacentBookChapter = {
  bookId: string
  chapterId: string
}

function parseChapterNumber(value: string): number | null {
  const chapterNumber = Number.parseInt(value, 10)
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
    return null
  }
  return chapterNumber
}

function bookIndexInCatalog(
  books: readonly { id: string }[],
  book: string,
): number {
  const exact = books.findIndex((entry) => entry.id === book)
  if (exact !== -1) {
    return exact
  }
  const upper = book.toUpperCase()
  return books.findIndex((entry) => entry.id === upper)
}

/**
 * Next or previous chapter, including the first/last chapter of the next/previous book.
 * Same idea as web `getAdjacentChapter`. Null at the ends of the list, or when
 * the catalog has not said how many chapters a book has.
 */
export function adjacentBookChapter(
  catalog: ReadonlyMap<string, BookCatalogEntry> | null,
  book: string,
  chapter: string,
  direction: 'next' | 'previous',
): AdjacentBookChapter | null {
  const chapterNumber = parseChapterNumber(chapter)
  if (chapterNumber === null) {
    return null
  }

  if (direction === 'previous' && chapterNumber > 1) {
    return { bookId: book, chapterId: String(chapterNumber - 1) }
  }

  if (catalog === null) {
    return null
  }

  const books = [...catalog.entries()].map(([id, entry]) => ({
    id,
    chapterCount: entry.chapterCount,
  }))
  const index = bookIndexInCatalog(books, book)
  if (index === -1) {
    return null
  }

  const current = books[index]
  if (current === undefined) {
    return null
  }

  if (direction === 'next') {
    // Without a chapter count there is no way to know whether the book ends
    // here, and rolling to the next book would skip the rest of this one.
    if (current.chapterCount === null) {
      return null
    }
    if (chapterNumber < current.chapterCount) {
      return { bookId: current.id, chapterId: String(chapterNumber + 1) }
    }
    const nextBook = books[index + 1]
    if (nextBook === undefined || nextBook.chapterCount === null || nextBook.chapterCount < 1) {
      return null
    }
    return { bookId: nextBook.id, chapterId: '1' }
  }

  const previousBook = books[index - 1]
  if (
    previousBook === undefined ||
    previousBook.chapterCount === null ||
    previousBook.chapterCount < 1
  ) {
    return null
  }
  return { bookId: previousBook.id, chapterId: String(previousBook.chapterCount) }
}
