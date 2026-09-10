import { getAdjacentChapter } from '@youversion/platform-core'
import { z } from 'zod'

const titleSchema = z.string().trim().min(1)
const bookIdSchema = z.string().trim().min(1)
const chapterEntrySchema = z.object({
  id: z.unknown().optional(),
  title: z.unknown().optional(),
})
const bookEntrySchema = z.object({
  id: z.unknown().optional(),
  usfm: z.unknown().optional(),
  title: z.unknown().optional(),
  chapters: z.unknown().optional(),
  intro: z.unknown().optional(),
})
const booksBodySchema = z.object({
  data: z.unknown().optional(),
})

export type ChapterCatalogEntry = {
  id: string
  title: string
}

export type BookCatalogEntry = {
  title: string
  /** Chapters in payload order, intro entries included. Null when the payload omitted the list. */
  chapters: readonly ChapterCatalogEntry[] | null
  intro: ChapterCatalogEntry | null
}

/** Chapter id plus its display title, falling back to the id the way web does. */
function chapterEntry(chapter: z.infer<typeof chapterEntrySchema>): ChapterCatalogEntry | null {
  const id = bookIdSchema.safeParse(chapter.id)
  if (!id.success) {
    return null
  }
  const title = titleSchema.safeParse(chapter.title)
  return { id: id.data, title: title.success ? title.data : id.data }
}

function chaptersForEntry(
  entry: z.infer<typeof bookEntrySchema>,
): readonly ChapterCatalogEntry[] | null {
  const chapters = z.array(chapterEntrySchema).safeParse(entry.chapters)
  if (!chapters.success) {
    return null
  }
  const parsed = chapters.data.map(chapterEntry).filter((c): c is ChapterCatalogEntry => c !== null)
  return parsed.length > 0 ? parsed : null
}

function introForEntry(entry: z.infer<typeof bookEntrySchema>): ChapterCatalogEntry | null {
  const intro = chapterEntrySchema.safeParse(entry.intro)
  return intro.success ? chapterEntry(intro.data) : null
}

function entryForBook(
  entry: z.infer<typeof bookEntrySchema>,
): { id: string; value: BookCatalogEntry } | null {
  const title = titleSchema.safeParse(entry.title)
  if (!title.success) {
    return null
  }
  const value: BookCatalogEntry = {
    title: title.data,
    chapters: chaptersForEntry(entry),
    intro: introForEntry(entry),
  }
  const id = bookIdSchema.safeParse(entry.id)
  if (id.success) {
    return { id: id.data, value }
  }
  const usfm = bookIdSchema.safeParse(entry.usfm)
  if (usfm.success) {
    return { id: usfm.data, value }
  }
  return null
}

const bookListSchema = z.array(bookEntrySchema)

function catalogFromEntries(
  entries: z.infer<typeof bookListSchema>,
): Map<string, BookCatalogEntry> {
  const catalog = new Map<string, BookCatalogEntry>()
  for (const entry of entries) {
    const parsed = entryForBook(entry)
    if (parsed !== null) {
      catalog.set(parsed.id, parsed.value)
    }
  }
  return catalog
}

/** Reads book id → title, chapter list, and intro from a `/v1/bibles/{id}/books` body. */
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

/** Catalog key for a book id. Consumers may pass `jhn`; the payload keys on `JHN`. */
function resolveBookKey(
  catalog: ReadonlyMap<string, BookCatalogEntry>,
  book: string,
): string | null {
  if (catalog.has(book)) {
    return book
  }
  const upper = book.toUpperCase()
  return catalog.has(upper) ? upper : null
}

export function entryFromBooksCatalog(
  catalog: ReadonlyMap<string, BookCatalogEntry> | null,
  book: string,
): BookCatalogEntry | null {
  if (catalog === null) {
    return null
  }
  const key = resolveBookKey(catalog, book)
  return key === null ? null : (catalog.get(key) ?? null)
}

/**
 * Display text for a chapter: the catalog's chapter title, the intro's title when the
 * chapter is that book's intro, else the raw id. Mirrors web's `chapterLabel`.
 */
export function chapterLabelForBook(entry: BookCatalogEntry | null, chapter: string): string {
  if (entry === null) {
    return chapter
  }
  if (entry.intro !== null && entry.intro.id === chapter) {
    return entry.intro.title
  }
  return entry.chapters?.find((c) => c.id === chapter)?.title ?? chapter
}

export type AdjacentBookChapter = {
  bookId: string
  chapterId: string
}

type AdjacentChapterBooks = Parameters<typeof getAdjacentChapter>[0]

function parseChapterNumber(value: string): number | null {
  const chapterNumber = Number.parseInt(value, 10)
  if (!Number.isFinite(chapterNumber) || chapterNumber < 1) {
    return null
  }
  return chapterNumber
}

/**
 * Next or previous chapter, crossing book boundaries and skipping intros. Delegates to
 * platform-core so native and web agree. Before the catalog lands, Previous can still
 * step back inside the book; Next needs the chapter list, so it stays off.
 */
export function adjacentBookChapter(
  catalog: ReadonlyMap<string, BookCatalogEntry> | null,
  book: string,
  chapter: string,
  direction: 'next' | 'previous',
): AdjacentBookChapter | null {
  if (catalog === null) {
    const chapterNumber = parseChapterNumber(chapter)
    if (direction === 'previous' && chapterNumber !== null && chapterNumber > 1) {
      return { bookId: book, chapterId: String(chapterNumber - 1) }
    }
    return null
  }

  const key = resolveBookKey(catalog, book)
  if (key === null) {
    return null
  }

  const books = [...catalog.entries()].map(([id, entry]) => ({
    id,
    chapters: entry.chapters === null ? undefined : entry.chapters.map((c) => ({ id: c.id })),
    intro: entry.intro === null ? undefined : { id: entry.intro.id },
  }))

  // SAFETY: `getAdjacentChapter` reads only `id`, `chapters[].id` and `intro.id`, all of which
  // these rows carry. The rest of `BibleBook` (`full_title`, `canon`, `passage_id`) is data the
  // books endpoint need not send, and inventing it would put fake values in a real shape.
  return getAdjacentChapter(books as AdjacentChapterBooks, key, chapter, direction)
}
