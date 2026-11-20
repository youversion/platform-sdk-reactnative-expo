import { z } from 'zod'

const bookSchema = z.object({
  id: z.unknown().optional(),
  usfm: z.unknown().optional(),
  title: z.unknown().optional(),
})

const booksSchema = z.union([z.array(bookSchema), z.object({ data: z.array(bookSchema) })])

const labelSchema = z.string().trim().min(1)

const PASSAGE = /^([A-Z0-9]{1,3})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/

function addBook(catalog: Map<string, string>, entry: z.infer<typeof bookSchema>): void {
  const title = labelSchema.safeParse(entry.title)
  if (!title.success) return
  const id = labelSchema.safeParse(entry.id)
  if (id.success) {
    catalog.set(id.data, title.data)
    return
  }
  const usfm = labelSchema.safeParse(entry.usfm)
  if (usfm.success) catalog.set(usfm.data, title.data)
}

/** Book titles from a `/v1/bibles/{id}/books` body. A bad row is skipped. */
export function bookTitlesFromBody(body: string): ReadonlyMap<string, string> {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return new Map()
  }
  const books = booksSchema.safeParse(parsed)
  if (!books.success) return new Map()
  const entries = Array.isArray(books.data) ? books.data : books.data.data
  const catalog = new Map<string, string>()
  for (const entry of entries) addBook(catalog, entry)
  return catalog
}

/** `JHN.3.16` becomes `John 3:16` once that book's title is known. */
export function formatPassageLabel(passageId: string, titles: ReadonlyMap<string, string>): string {
  const match = PASSAGE.exec(passageId)
  if (match === null) return passageId
  const bookCode = match[1]
  const chapter = match[2]
  if (bookCode === undefined || chapter === undefined) return passageId
  const book = titles.get(bookCode) ?? bookCode
  const start = match[3]
  if (start === undefined) return `${book} ${chapter}`
  const end = match[4]
  if (end === undefined) return `${book} ${chapter}:${start}`
  return `${book} ${chapter}:${start}-${end}`
}
