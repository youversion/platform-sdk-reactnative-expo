import { z } from 'zod'

const abbreviationSchema = z.string().trim().min(1)
const versionBodySchema = z.object({
  local_abbreviation: z.unknown().optional(),
  abbreviation: z.unknown().optional(),
  data: z.unknown().optional(),
})

type VersionBody = z.infer<typeof versionBodySchema>

function abbreviationFromFields(fields: VersionBody): string | null {
  const local = abbreviationSchema.safeParse(fields.local_abbreviation)
  if (local.success) {
    return local.data
  }
  const abbreviation = abbreviationSchema.safeParse(fields.abbreviation)
  if (abbreviation.success) {
    return abbreviation.data
  }
  return null
}

/** Reads the short name off a `/v1/bibles/{id}` body. Prefers the localized field. */
export function abbreviationFromVersionBody(body: string): string | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }

  const envelope = versionBodySchema.safeParse(parsed)
  if (!envelope.success) {
    return null
  }

  const top = abbreviationFromFields(envelope.data)
  if (top !== null) {
    return top
  }

  const nested = versionBodySchema.safeParse(envelope.data.data)
  if (!nested.success) {
    return null
  }
  return abbreviationFromFields(nested.data)
}
