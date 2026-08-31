import { contentLifetimeMs, DEFAULT_CONTENT_LIFETIME_MS } from '../content-lifetime'

describe('contentLifetimeMs', () => {
  it('derives the lifetime from max-age', () => {
    expect(contentLifetimeMs('max-age=3600', null)).toBe(3_600_000)
  })

  it('subtracts Age from max-age', () => {
    expect(contentLifetimeMs('public, max-age=3600', '600')).toBe(3_000_000)
  })

  it('clamps at zero when Age meets or exceeds max-age', () => {
    expect(contentLifetimeMs('max-age=600', '600')).toBe(0)
    expect(contentLifetimeMs('max-age=600', '601')).toBe(0)
  })

  it('treats a missing or unparseable Age as zero', () => {
    expect(contentLifetimeMs('max-age=60', 'abc')).toBe(60_000)
  })

  it.each([null, '', 'public', 'max-age=abc', 'max-age=-1', 's-maxage=60'])(
    'falls back to seven days without a usable max-age (%p)',
    (cacheControl) => {
      expect(contentLifetimeMs(cacheControl, null)).toBe(DEFAULT_CONTENT_LIFETIME_MS)
    },
  )

  it.each(['no-store', 'no-cache', 'No-Cache', 'public, max-age=3600, no-store', 'no-cache="set-cookie"'])(
    'prohibits storing for %p',
    (cacheControl) => {
      expect(contentLifetimeMs(cacheControl, null)).toBeNull()
    },
  )
})
