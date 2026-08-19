import { z } from 'zod'

type ReaderLocationFields = {
  book: string | null
  chapter: string | null
  versionId: number | null
}

const storedBookSchema = z.string().trim().min(1)
const storedVersionIdSchema = z.number().int().finite().gte(1)
const locationSchema = z.object({
  book: z.string().optional().nullable(),
  chapter: z.union([z.string(), z.number()]).optional().nullable(),
  versionId: z.number().optional().nullable(),
})

export function parseStoredBook(raw: string): string | null {
  const parsed = storedBookSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function parseStoredChapter(raw: string): string | null {
  const trimmed = storedBookSchema.safeParse(raw)
  if (!trimmed.success) return null
  const parsed = Number.parseInt(trimmed.data, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return String(parsed)
}

export function parseStoredVersionId(raw: number): number | null {
  const parsed = storedVersionIdSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function parseStoredLocation(raw: string): ReaderLocationFields {
  try {
    const parsed = locationSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return { book: null, chapter: null, versionId: null }
    }

    const chapter =
      parsed.data.chapter === undefined || parsed.data.chapter === null
        ? ''
        : String(parsed.data.chapter)

    return {
      book: parseStoredBook(parsed.data.book ?? ''),
      chapter: parseStoredChapter(chapter),
      versionId: parseStoredVersionId(parsed.data.versionId ?? 0),
    }
  } catch {
    return { book: null, chapter: null, versionId: null }
  }
}
