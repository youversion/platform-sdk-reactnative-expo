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
  if (segments.length !== 3) {
    throw new Error("Invalid JWT: expected 3 segments separated by '.'")
  }
  const payloadJson = base64URLDecodeToString(segments[1]!)
  return JSON.parse(payloadJson)
}

// Convenience: produce the YVUserInfo shape our hook returns.
export function deriveUserInfo(idToken: string): YVUserInfo {
  const p = decodeIdToken(idToken)
  return {
    id: typeof p.sub === 'string' ? p.sub : undefined,
    name: typeof p.name === 'string' ? p.name : undefined,
    email: typeof p.email === 'string' ? p.email : undefined,
    avatarUrl: typeof p.profile_picture === 'string' ? p.profile_picture : undefined,
  }
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
