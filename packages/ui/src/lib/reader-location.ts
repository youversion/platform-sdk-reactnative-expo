type ReaderLocationFields = {
  book: string | null
  chapter: string | null
  versionId: number | null
}

export function parseStoredBook(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function parseStoredChapter(value: unknown): string | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1) return null
    return String(Math.trunc(value))
  }
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  const parsed = Number.parseInt(trimmed, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return String(parsed)
}

export function parseStoredVersionId(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return null
  return value
}

function isRecord(value: object): value is Record<string, unknown> {
  return !Array.isArray(value)
}

export function parseStoredLocation(value: unknown): ReaderLocationFields {
  if (value == null || typeof value !== 'object' || !isRecord(value)) {
    return { book: null, chapter: null, versionId: null }
  }

  return {
    book: parseStoredBook(value.book),
    chapter: parseStoredChapter(value.chapter),
    versionId: parseStoredVersionId(value.versionId),
  }
}
