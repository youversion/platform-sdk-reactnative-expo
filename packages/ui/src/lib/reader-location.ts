import { z } from 'zod'

type ReaderLocationFields = {
  book: string | null
  chapter: string | null
  versionId: number | null
}

const storedBookSchema = z.string().trim().min(1)
const storedVersionIdSchema = z.number().int().finite().gte(1)
const storedChapterValueSchema = z.union([z.string(), z.number()])
const storedLocationEnvelopeSchema = z.object({
  book: z.unknown().optional(),
  chapter: z.unknown().optional(),
  versionId: z.unknown().optional(),
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
    const envelope = storedLocationEnvelopeSchema.safeParse(JSON.parse(raw))
    if (!envelope.success) {
      return { book: null, chapter: null, versionId: null }
    }

    const chapterValue = storedChapterValueSchema.safeParse(envelope.data.chapter)
    const bookValue = storedBookSchema.safeParse(envelope.data.book)
    const versionValue = storedVersionIdSchema.safeParse(envelope.data.versionId)

    return {
      book: bookValue.success ? parseStoredBook(bookValue.data) : null,
      chapter: chapterValue.success ? parseStoredChapter(String(chapterValue.data)) : null,
      versionId: versionValue.success ? parseStoredVersionId(versionValue.data) : null,
    }
  } catch {
    return { book: null, chapter: null, versionId: null }
  }
}
