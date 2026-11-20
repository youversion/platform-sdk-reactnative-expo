import { z } from 'zod'

export const DEFAULT_READER_VERSION_ID = 3034

/** Zustand persist key for the reader's saved chapter. Same string the reader writes. */
export const READER_LOCATION_KEY = 'yv-reader:location'

const locationSchema = z.object({
  state: z
    .object({
      versionId: z.number().int().positive().optional(),
    })
    .optional(),
  versionId: z.number().int().positive().optional(),
})

/** The Bible the reader last saved, or the sample default when nothing valid is stored. */
export function versionIdFromPersistedLocation(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_READER_VERSION_ID
  try {
    const parsed = locationSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return DEFAULT_READER_VERSION_ID
    return parsed.data.state?.versionId ?? parsed.data.versionId ?? DEFAULT_READER_VERSION_ID
  } catch {
    return DEFAULT_READER_VERSION_ID
  }
}
