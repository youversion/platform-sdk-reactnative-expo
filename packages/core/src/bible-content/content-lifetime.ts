// Content Lifetime (ADR 0020): `max-age − Age` clamped at zero, seven days
// without a usable `max-age`, `no-cache`/`no-store` never stored, `Expires`
// and `Date` ignored. Same rules as the Swift and Kotlin SDKs.

export const DEFAULT_CONTENT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000

/** Milliseconds the response may be served from the store; null when storing is prohibited. */
export function contentLifetimeMs(cacheControl: string | null, age: string | null): number | null {
  const directives = new Map<string, string | undefined>()
  for (const part of (cacheControl ?? '').split(',')) {
    const eq = part.indexOf('=')
    const name = (eq === -1 ? part : part.slice(0, eq)).trim().toLowerCase()
    if (name !== '') directives.set(name, eq === -1 ? undefined : part.slice(eq + 1).trim())
  }
  if (directives.has('no-store') || directives.has('no-cache')) return null

  const maxAgeSeconds = parseSeconds(directives.get('max-age'))
  if (maxAgeSeconds === null) return DEFAULT_CONTENT_LIFETIME_MS

  const ageSeconds = parseSeconds(age ?? undefined) ?? 0
  return Math.max(0, maxAgeSeconds - ageSeconds) * 1000
}

function parseSeconds(value: string | undefined): number | null {
  return value !== undefined && /^\d+$/.test(value) ? Number(value) : null
}
