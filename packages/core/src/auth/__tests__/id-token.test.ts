import { decodeIdToken, deriveUserInfo, sanitizeAvatarUrl } from '../id-token'

function makeJwt(payload: unknown): string {
  const json = JSON.stringify(payload)
  const b64url = Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `aaa.${b64url}.bbb`
}

describe('decodeIdToken', () => {
  it('parses the payload of a valid 3-segment JWT', () => {
    const jwt = makeJwt({ sub: 'u1', name: 'Ada' })
    expect(decodeIdToken(jwt)).toEqual({ sub: 'u1', name: 'Ada' })
  })

  it('preserves unknown extra fields in the payload', () => {
    const jwt = makeJwt({ sub: 'u1', custom_claim: 42 })
    expect(decodeIdToken(jwt)).toEqual({ sub: 'u1', custom_claim: 42 })
  })

  it('throws on a 1-segment input', () => {
    expect(() => decodeIdToken('only-one-segment')).toThrow(/expected 3 segments/)
  })

  it('throws on a 2-segment input', () => {
    expect(() => decodeIdToken('aaa.bbb')).toThrow(/expected 3 segments/)
  })

  it('throws on a 4-segment input', () => {
    expect(() => decodeIdToken('aaa.bbb.ccc.ddd')).toThrow(/expected 3 segments/)
  })

  it('throws on an empty string', () => {
    expect(() => decodeIdToken('')).toThrow(/expected 3 segments/)
  })

  it('decodes UTF-8 multi-byte characters in the payload', () => {
    const jwt = makeJwt({ name: 'José', email: '李四@example.com' })
    expect(decodeIdToken(jwt)).toEqual({ name: 'José', email: '李四@example.com' })
  })
})

describe('deriveUserInfo', () => {
  it('maps sub→id, name, email, profile_picture→avatarUrl', () => {
    const jwt = makeJwt({
      sub: 'u1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      profile_picture: 'https://cdn.example.com/a.png',
    })
    expect(deriveUserInfo(jwt)).toEqual({
      id: 'u1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      avatarUrl: 'https://cdn.example.com/a.png',
    })
  })

  it('returns undefined for missing fields', () => {
    const jwt = makeJwt({ sub: 'u1' })
    expect(deriveUserInfo(jwt)).toEqual({
      id: 'u1',
      name: undefined,
      email: undefined,
      avatarUrl: undefined,
    })
  })

  it('returns undefined for non-string field values', () => {
    const jwt = makeJwt({ sub: 123, name: null, email: { x: 1 }, profile_picture: false })
    expect(deriveUserInfo(jwt)).toEqual({
      id: undefined,
      name: undefined,
      email: undefined,
      avatarUrl: undefined,
    })
  })

  it('ignores extra claims', () => {
    const jwt = makeJwt({ sub: 'u1', custom: 'ignored' })
    expect(deriveUserInfo(jwt)).toEqual({
      id: 'u1',
      name: undefined,
      email: undefined,
      avatarUrl: undefined,
    })
  })

  it('drops a sentinel profile_picture URL (backend "no photo" placeholder)', () => {
    const jwt = makeJwt({ sub: 'u1', profile_picture: 'https://none/' })
    expect(deriveUserInfo(jwt).avatarUrl).toBeUndefined()
  })
})

describe('sanitizeAvatarUrl', () => {
  it('passes a valid https URL through unchanged', () => {
    expect(sanitizeAvatarUrl('https://cdn.example.com/me.jpg')).toBe(
      'https://cdn.example.com/me.jpg',
    )
  })

  it('passes a valid http URL through', () => {
    expect(sanitizeAvatarUrl('http://cdn.example.com/me.jpg')).toBe('http://cdn.example.com/me.jpg')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeAvatarUrl('  https://cdn.example.com/me.jpg  ')).toBe(
      'https://cdn.example.com/me.jpg',
    )
  })

  it('keeps a real URL whose path merely contains a sentinel word', () => {
    expect(sanitizeAvatarUrl('https://cdn.example.com/none.jpg')).toBe(
      'https://cdn.example.com/none.jpg',
    )
  })

  it.each([
    ['https://none/', 'sentinel host'],
    ['https://null/', 'sentinel host null'],
    ['None', 'bare sentinel word'],
    ['none', 'lowercase bare sentinel'],
    ['', 'empty string'],
    ['   ', 'whitespace only'],
    ['ftp://cdn.example.com/me.jpg', 'non-http(s) scheme'],
    ['not a url', 'unparseable'],
  ])('returns undefined for %s (%s)', (input) => {
    expect(sanitizeAvatarUrl(input)).toBeUndefined()
  })

  it.each([[null], [undefined], [false], [42], [{ x: 1 }]])(
    'returns undefined for non-string value %p',
    (input) => {
      expect(sanitizeAvatarUrl(input)).toBeUndefined()
    },
  )
})
