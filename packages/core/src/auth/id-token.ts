import type { YVUserInfo } from './types'

export type IdTokenPayload = {
  sub?: string
  name?: string
  email?: string
  profile_picture?: string
  nonce?: string
  [key: string]: unknown
}

// Decode a JWT's payload segment.
export function decodeIdToken(jwt: string): IdTokenPayload {
  const segments = jwt.split('.')
  const payload = segments[1]
  if (segments.length !== 3 || payload === undefined) {
    throw new Error("Invalid JWT: expected 3 segments separated by '.'")
  }
  const payloadJson = base64URLDecodeToString(payload)
  return JSON.parse(payloadJson)
}

// Convenience: produce the YVUserInfo shape our hook returns.
export function deriveUserInfo(idToken: string): YVUserInfo {
  const p = decodeIdToken(idToken)
  return {
    id: typeof p.sub === 'string' ? p.sub : undefined,
    name: typeof p.name === 'string' ? p.name : undefined,
    email: typeof p.email === 'string' ? p.email : undefined,
    avatarUrl: sanitizeAvatarUrl(p.profile_picture),
  }
}

// Placeholder values the backend has been seen to emit for "no photo" — both
// bare (e.g. "None") and as a URL host (e.g. "https://none/"). Any of these
// means the user has no avatar, so we drop them rather than hand consumers a
// URL that resolves to nothing. See docs/bug-reports/auth-website-issues.md.
const AVATAR_SENTINELS = new Set(['', 'none', 'null', 'undefined', 'false'])

// Return a usable avatar URL, or undefined when the claim is absent, a
// sentinel, or not an http(s) URL. Defensive: the real fix is upstream (the
// backend should omit the claim when there is no photo).
export function sanitizeAvatarUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  if (AVATAR_SENTINELS.has(trimmed.toLowerCase())) {
    return undefined
  }

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return undefined
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return undefined
  }
  if (AVATAR_SENTINELS.has(parsed.hostname.toLowerCase())) {
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
