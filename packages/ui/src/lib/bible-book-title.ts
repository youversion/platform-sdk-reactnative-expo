import { z } from 'zod'

const titleSchema = z.string().trim().min(1)
const bookIdSchema = z.string().trim().min(1)
const bookEntrySchema = z.object({
  id: z.unknown().optional(),
  usfm: z.unknown().optional(),
  title: z.unknown().optional(),
})
const booksBodySchema = z.object({
  data: z.unknown().optional(),
})

function titleForEntry(entry: z.infer<typeof bookEntrySchema>): { id: string; title: string } | null {
  const title = titleSchema.safeParse(entry.title)
  if (!title.success) {
    return null
  }
  const id = bookIdSchema.safeParse(entry.id)
  if (id.success) {
    return { id: id.data, title: title.data }
  }
  const usfm = bookIdSchema.safeParse(entry.usfm)
  if (usfm.success) {
    return { id: usfm.data, title: title.data }
  }
  return null
}

const bookListSchema = z.array(bookEntrySchema)

function titlesFromEntries(entries: z.infer<typeof bookListSchema>): Map<string, string> {
  const titles = new Map<string, string>()
  for (const entry of entries) {
    const parsed = titleForEntry(entry)
    if (parsed !== null) {
      titles.set(parsed.id, parsed.title)
    }
  }
  return titles
}

/** Reads book id → title from a `/v1/bibles/{id}/books` body. */
export function titlesFromBooksBody(body: string): ReadonlyMap<string, string> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }

  const asList = bookListSchema.safeParse(parsed)
  if (asList.success) {
    return titlesFromEntries(asList.data)
  }

  const envelope = booksBodySchema.safeParse(parsed)
  if (!envelope.success) {
    return null
  }
  const fromData = bookListSchema.safeParse(envelope.data.data)
  if (!fromData.success) {
    return null
  }
  return titlesFromEntries(fromData.data)
}

export function titleFromBooksCatalog(
  titles: ReadonlyMap<string, string> | null,
  book: string,
): string | null {
  if (titles === null) {
    return null
  }
  const exact = titles.get(book)
  if (exact !== undefined) {
    return exact
  }
  return titles.get(book.toUpperCase()) ?? null
}
