import { z } from 'zod'

import type { YVUserInfo } from './types'

const optionalJwtString = z.string().optional().catch(undefined)

const idTokenPayloadSchema = z.object({
  sub: optionalJwtString,
  name: optionalJwtString,
  email: optionalJwtString,
  profile_picture: optionalJwtString,
  nonce: optionalJwtString,
})

export type IdTokenPayload = z.infer<typeof idTokenPayloadSchema>

// Decode a JWT's payload segment.
export function decodeIdToken(jwt: string): IdTokenPayload {
  const segments = jwt.split('.')
  const payload = segments[1]
  if (segments.length !== 3 || payload === undefined) {
    throw new Error("Invalid JWT: expected 3 segments separated by '.'")
  }
  const payloadJson = base64URLDecodeToString(payload)
  const parsed = idTokenPayloadSchema.safeParse(JSON.parse(payloadJson))
  if (!parsed.success) {
    throw new Error('Invalid JWT payload')
  }
  return parsed.data
}

// Convenience: produce the YVUserInfo shape our hook returns.
export function deriveUserInfo(idToken: string): YVUserInfo {
  const p = decodeIdToken(idToken)
  return {
    id: p.sub,
    name: p.name,
    email: p.email,
    avatarUrl: p.profile_picture === undefined ? undefined : sanitizeAvatarUrl(p.profile_picture),
  }
}

// Placeholder values the backend has been seen to emit for "no photo" — both
// bare (e.g. "None") and as a URL host (e.g. "https://none/"). Any of these
// means the user has no avatar, so we drop them rather than hand consumers a
// URL that resolves to nothing. See docs/bug-reports/auth-website-issues.md.
const AVATAR_SENTINELS = new Set(['', 'none', 'null', 'undefined', 'false'])

const avatarUrlSchema = z.string().trim().min(1)

// Return a usable avatar URL, or undefined when the claim is absent, a
// sentinel, or not an https URL. https-only is deliberate: iOS ATS and Android
// cleartext-traffic defaults both block http image loads in RN apps, so an http
// avatar would fail to render anyway — dropping it yields the safe undefined
// fallback. Defensive: the real fix is upstream (the backend should omit the
// claim when there is no photo).
export function sanitizeAvatarUrl(raw: string): string | undefined {
  const parsed = avatarUrlSchema.safeParse(raw)
  if (!parsed.success) {
    return undefined
  }
  const trimmed = parsed.data
  if (AVATAR_SENTINELS.has(trimmed.toLowerCase())) {
    return undefined
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmed)
  } catch {
    return undefined
  }
  if (parsedUrl.protocol !== 'https:') {
    return undefined
  }
  if (AVATAR_SENTINELS.has(parsedUrl.hostname.toLowerCase())) {
    return undefined
  }

  return trimmed
}

// base64url string → UTF-8 string.
function base64URLDecodeToString(input: string): string {
  let s = input.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) {
    s += '='
  }
  const binary = atob(s)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  // TextDecoder needed for non-ASCII chars (names like "José" or "李四").
  return new TextDecoder('utf-8').decode(bytes)
}
