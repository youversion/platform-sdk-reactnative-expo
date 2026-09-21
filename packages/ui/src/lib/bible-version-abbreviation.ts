import { z } from 'zod'

const abbreviationSchema = z.string().trim().min(1)
const languageIdSchema = z.string().trim().min(1)
const versionBodySchema = z.object({
  localized_abbreviation: z.unknown().optional(),
  abbreviation: z.unknown().optional(),
  language_tag: z.unknown().optional(),
  data: z.unknown().optional(),
})

type VersionBody = z.infer<typeof versionBodySchema>

export type VersionMeta = {
  abbreviation: string | null
  languageId: string | null
}

function abbreviationFromFields(fields: VersionBody): string | null {
  const localized = abbreviationSchema.safeParse(fields.localized_abbreviation)
  if (localized.success) {
    return localized.data
  }
  const abbreviation = abbreviationSchema.safeParse(fields.abbreviation)
  if (abbreviation.success) {
    return abbreviation.data
  }
  return null
}

function languageIdFromFields(fields: VersionBody): string | null {
  const languageId = languageIdSchema.safeParse(fields.language_tag)
  if (languageId.success) {
    return languageId.data
  }
  return null
}

function metaFromFields(fields: VersionBody): VersionMeta {
  return {
    abbreviation: abbreviationFromFields(fields),
    languageId: languageIdFromFields(fields),
  }
}

function firstPresent(primary: VersionMeta, fallback: VersionMeta): VersionMeta {
  return {
    abbreviation: primary.abbreviation ?? fallback.abbreviation,
    languageId: primary.languageId ?? fallback.languageId,
  }
}

/** Reads the short name and language off a `/v1/bibles/{id}` body. Prefers the localized field. */
export function versionMetaFromBody(body: string): VersionMeta {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return { abbreviation: null, languageId: null }
  }

  const envelope = versionBodySchema.safeParse(parsed)
  if (!envelope.success) {
    return { abbreviation: null, languageId: null }
  }

  const top = metaFromFields(envelope.data)
  const nested = versionBodySchema.safeParse(envelope.data.data)
  if (!nested.success) {
    return top
  }
  return firstPresent(top, metaFromFields(nested.data))
}
