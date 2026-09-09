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
