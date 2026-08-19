import { createHash, randomBytes as nodeRandomBytes } from 'node:crypto'

import * as Crypto from 'expo-crypto'
import { generatePKCEParameters } from '../pkce'

let mockGetRandomBytesAsync: jest.SpiedFunction<typeof Crypto.getRandomBytesAsync>
let mockDigestStringAsync: jest.SpiedFunction<typeof Crypto.digestStringAsync>

function fillBytes(byte: number, length: number): Uint8Array {
  return new Uint8Array(length).fill(byte)
}

function base64UrlSha256(input: string): string {
  return createHash('sha256')
    .update(input)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Order matches `Promise.all([verifier(32), nonce(24), state(24)])` in pkce.ts.
function seedFixedBytes() {
  mockGetRandomBytesAsync
    .mockResolvedValueOnce(fillBytes(0xab, 32))
    .mockResolvedValueOnce(fillBytes(0xcd, 24))
    .mockResolvedValueOnce(fillBytes(0xef, 24))
}

beforeEach(() => {
  mockGetRandomBytesAsync = jest.spyOn(Crypto, 'getRandomBytesAsync')
  mockDigestStringAsync = jest.spyOn(Crypto, 'digestStringAsync')
  // Use a real SHA-256 inside the mock so codeChallenge assertions are meaningful.
  mockDigestStringAsync.mockImplementation((_algo, input: string) =>
    Promise.resolve(createHash('sha256').update(input).digest('base64')),
  )
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('generatePKCEParameters', () => {
  it('returns a base64url verifier (43 chars), state (32), and nonce (32)', async () => {
    seedFixedBytes()
    const { codeVerifier, state, nonce } = await generatePKCEParameters()
    expect(codeVerifier).toHaveLength(43)
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(state).toHaveLength(32)
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(nonce).toHaveLength(32)
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('computes codeChallenge as the base64url SHA-256 of codeVerifier', async () => {
    seedFixedBytes()
    const { codeVerifier, codeChallenge } = await generatePKCEParameters()
    expect(codeChallenge).toBe(base64UrlSha256(codeVerifier))
    expect(mockDigestStringAsync).toHaveBeenCalledWith('SHA-256', codeVerifier, {
      encoding: 'base64',
    })
  })

  it('produces distinct output across successive calls with fresh random bytes', async () => {
    mockGetRandomBytesAsync.mockImplementation((n: number) =>
      Promise.resolve(new Uint8Array(nodeRandomBytes(n))),
    )
    const a = await generatePKCEParameters()
    const b = await generatePKCEParameters()
    expect(a.codeVerifier).not.toBe(b.codeVerifier)
    expect(a.state).not.toBe(b.state)
    expect(a.nonce).not.toBe(b.nonce)
    expect(a.codeChallenge).not.toBe(b.codeChallenge)
  })
})
