import * as Crypto from 'expo-crypto'

const VERIFIER_BYTES = 32
const STATE_BYTES = 24
const NONCE_BYTES = 24

export type PKCEParameters = {
  codeVerifier: string // 43 chars, base64url, [A-Za-z0-9_-]
  codeChallenge: string // 43 chars, base64url SHA-256 of codeVerifier
  nonce: string // base64url — replay protection
  state: string // 32 chars, base64url — CSRF token
}

export async function generatePKCEParameters(): Promise<PKCEParameters> {
  const [verifierBytes, nonceBytes, stateBytes] = await Promise.all([
    randomBytes(VERIFIER_BYTES),
    randomBytes(NONCE_BYTES),
    randomBytes(STATE_BYTES),
  ])
  const codeVerifier = bytesToBase64URL(verifierBytes)
  const codeChallenge = base64ToBase64URL(await sha256AsBase64(codeVerifier))
  return {
    codeVerifier,
    codeChallenge,
    state: bytesToBase64URL(stateBytes),
    nonce: bytesToBase64URL(nonceBytes),
  }
}

// Cryptographically secure random bytes (CSPRNG-backed by the OS).
function randomBytes(byteLength: number): Promise<Uint8Array> {
  return Crypto.getRandomBytesAsync(byteLength)
}

// SHA-256 of the input as standard base64. Caller converts to base64url if needed.
function sha256AsBase64(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
    encoding: Crypto.CryptoEncoding.BASE64,
  })
}

function bytesToBase64URL(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return base64ToBase64URL(btoa(binary))
}

function base64ToBase64URL(s: string): string {
  return s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
