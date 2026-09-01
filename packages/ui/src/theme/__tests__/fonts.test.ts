import {
  buildFontMap,
  DEFAULT_API_HOST,
  fetchUntitledSerifFont,
  fontMapKey,
  pickTtfSources,
  UNTITLED_SERIF_FONT_ID,
  type UntitledSerifFont,
} from '../fonts'

const UNTITLED_SERIF_FONT: UntitledSerifFont = {
  id: 1,
  slug: 'untitled-serif',
  family: 'Untitled Serif',
  variants: [
    {
      weight: 400,
      style: 'normal',
      sources: [
        { format: 'woff2', url: 'https://cdn.youversion.com/test-fixtures/regular.woff2' },
        { format: 'ttf', url: 'https://cdn.youversion.com/test-fixtures/regular.ttf' },
      ],
    },
    {
      weight: 400,
      style: 'italic',
      sources: [
        { format: 'woff2', url: 'https://cdn.youversion.com/test-fixtures/italic.woff2' },
        { format: 'ttf', url: 'https://cdn.youversion.com/test-fixtures/italic.ttf' },
      ],
    },
    {
      weight: 500,
      style: 'normal',
      sources: [
        { format: 'woff2', url: 'https://cdn.youversion.com/test-fixtures/medium.woff2' },
        { format: 'ttf', url: 'https://cdn.youversion.com/test-fixtures/medium.ttf' },
      ],
    },
    {
      weight: 500,
      style: 'italic',
      sources: [
        { format: 'woff2', url: 'https://cdn.youversion.com/test-fixtures/medium-italic.woff2' },
        { format: 'ttf', url: 'https://cdn.youversion.com/test-fixtures/medium-italic.ttf' },
      ],
    },
    {
      weight: 700,
      style: 'normal',
      sources: [
        { format: 'woff2', url: 'https://cdn.youversion.com/test-fixtures/bold.woff2' },
        { format: 'ttf', url: 'https://cdn.youversion.com/test-fixtures/bold.ttf' },
      ],
    },
    {
      weight: 700,
      style: 'italic',
      sources: [
        {
          format: 'woff2',
          url: 'https://cdn.youversion.com/test-fixtures/bold-italic.woff2',
        },
        { format: 'ttf', url: 'https://cdn.youversion.com/test-fixtures/bold-italic.ttf' },
      ],
    },
  ],
}

const mockFetch: jest.MockedFunction<typeof fetch> = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch
})

afterEach(() => {
  jest.restoreAllMocks()
})

type WrongFamilyFont = Omit<UntitledSerifFont, 'family'> & { family: string }

type FontsApiJson = UntitledSerifFont | WrongFamilyFont | { error: string } | { id: number }

function jsonResponse(body: FontsApiJson, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: String(status),
    headers: { 'content-type': 'application/json' },
  })
}

describe('fontMapKey', () => {
  it('keeps 400 normal as the family name', () => {
    expect(fontMapKey('Untitled Serif', 400, 'normal')).toBe('Untitled Serif')
    expect(fontMapKey('Inter', 400, 'normal')).toBe('Inter')
  })

  it('appends Android weight and italic suffixes', () => {
    expect(fontMapKey('Untitled Serif', 400, 'italic')).toBe('Untitled Serif_italic')
    expect(fontMapKey('Untitled Serif', 500, 'normal')).toBe('Untitled Serif_medium')
    expect(fontMapKey('Untitled Serif', 500, 'italic')).toBe('Untitled Serif_medium_italic')
    expect(fontMapKey('Untitled Serif', 700, 'normal')).toBe('Untitled Serif_bold')
    expect(fontMapKey('Untitled Serif', 700, 'italic')).toBe('Untitled Serif_bold_italic')
  })
})

describe('pickTtfSources', () => {
  it('drops woff2 and keeps ttf for every weight and style', () => {
    const faces = pickTtfSources(UNTITLED_SERIF_FONT)

    expect(faces).toHaveLength(6)
    expect(faces.every((face) => face.uri.endsWith('.ttf'))).toBe(true)
    expect(faces.map((face) => `${face.weight}-${face.style}`).sort()).toEqual([
      '400-italic',
      '400-normal',
      '500-italic',
      '500-normal',
      '700-italic',
      '700-normal',
    ])
  })

  it('skips a variant that has no ttf source', () => {
    const faces = pickTtfSources({
      ...UNTITLED_SERIF_FONT,
      variants: [
        {
          weight: 400,
          style: 'normal',
          sources: [
            {
              format: 'woff2',
              url: 'https://cdn.youversion.com/test-fixtures/regular.woff2',
            },
          ],
        },
      ],
    })

    expect(faces).toEqual([])
  })

  it('skips a ttf url that is not https', () => {
    const faces = pickTtfSources({
      ...UNTITLED_SERIF_FONT,
      variants: [
        {
          weight: 400,
          style: 'normal',
          sources: [
            { format: 'ttf', url: 'http://cdn.youversion.com/test-fixtures/regular.ttf' },
          ],
        },
      ],
    })

    expect(faces).toEqual([])
  })

  it('skips a ttf url whose host is not YouVersion', () => {
    const faces = pickTtfSources({
      ...UNTITLED_SERIF_FONT,
      variants: [
        {
          weight: 400,
          style: 'normal',
          sources: [{ format: 'ttf', url: 'https://evil.example/untitled-serif.ttf' }],
        },
      ],
    })

    expect(faces).toEqual([])
  })

  it('keeps ttf urls from api.youversion.com and cdn.youversion.com', () => {
    const faces = pickTtfSources({
      ...UNTITLED_SERIF_FONT,
      variants: [
        {
          weight: 400,
          style: 'normal',
          sources: [
            { format: 'ttf', url: 'https://cdn.youversion.com/test-fixtures/regular.ttf' },
          ],
        },
        {
          weight: 700,
          style: 'normal',
          sources: [
            { format: 'ttf', url: 'https://api.youversion.com/test-fixtures/bold.ttf' },
          ],
        },
      ],
    })

    expect(faces.map((face) => face.uri)).toEqual([
      'https://cdn.youversion.com/test-fixtures/regular.ttf',
      'https://api.youversion.com/test-fixtures/bold.ttf',
    ])
  })

  it('keeps allowed faces and drops the rest in a mixed payload', () => {
    const faces = pickTtfSources({
      ...UNTITLED_SERIF_FONT,
      variants: [
        {
          weight: 400,
          style: 'normal',
          sources: [
            { format: 'ttf', url: 'https://cdn.youversion.com/test-fixtures/regular.ttf' },
          ],
        },
        {
          weight: 700,
          style: 'normal',
          sources: [{ format: 'ttf', url: 'https://evil.example/bold.ttf' }],
        },
      ],
    })

    expect(faces).toEqual([
      {
        family: 'Untitled Serif',
        weight: 400,
        style: 'normal',
        uri: 'https://cdn.youversion.com/test-fixtures/regular.ttf',
      },
    ])
  })
})

describe('buildFontMap', () => {
  it('registers 400 normal as Untitled Serif and suffixes the other faces', () => {
    const map = buildFontMap(pickTtfSources(UNTITLED_SERIF_FONT))

    expect(map['Untitled Serif']).toEqual({
      uri: 'https://cdn.youversion.com/test-fixtures/regular.ttf',
    })
    expect(map['Untitled Serif_italic']?.uri).toContain('italic.ttf')
    expect(map['Untitled Serif_medium']?.uri).toContain('medium.ttf')
    expect(map['Untitled Serif_medium_italic']?.uri).toContain('medium-italic.ttf')
    expect(map['Untitled Serif_bold']?.uri).toContain('bold.ttf')
    expect(map['Untitled Serif_bold_italic']?.uri).toContain('bold-italic.ttf')
    expect(Object.keys(map)).toHaveLength(6)
  })
})

describe('fetchUntitledSerifFont', () => {
  it('skips the request when the app key is empty or whitespace', async () => {
    await expect(fetchUntitledSerifFont({ appKey: '' })).resolves.toBeNull()
    await expect(fetchUntitledSerifFont({ appKey: '   ' })).resolves.toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('GETs /v1/fonts/1 with the app-key header and no query string', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(UNTITLED_SERIF_FONT))

    const font = await fetchUntitledSerifFont({ appKey: 'test-key' })

    expect(font?.family).toBe('Untitled Serif')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const firstCall = mockFetch.mock.calls[0]
    if (firstCall === undefined) {
      throw new Error('expected fetch to have been called')
    }
    const [url, init] = firstCall
    expect(url).toBe(`https://${DEFAULT_API_HOST}/v1/fonts/${UNTITLED_SERIF_FONT_ID}`)
    expect(String(url)).not.toContain('app_key')
    expect(new Headers(init?.headers).get('X-YVP-App-Key')).toBe('test-key')
    expect(new Headers(init?.headers).get('Accept')).toBe('application/json')
  })

  it('uses a custom apiHost', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(UNTITLED_SERIF_FONT))

    await fetchUntitledSerifFont({ appKey: 'test-key', apiHost: 'api-staging.youversion.com' })

    const firstCall = mockFetch.mock.calls[0]
    if (firstCall === undefined) {
      throw new Error('expected fetch to have been called')
    }
    expect(String(firstCall[0])).toBe(
      `https://api-staging.youversion.com/v1/fonts/${UNTITLED_SERIF_FONT_ID}`,
    )
  })

  it('throws when the Fonts API is not ok', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'unauthorized' }, 401))

    await expect(fetchUntitledSerifFont({ appKey: 'test-key' })).rejects.toThrow(
      'Fonts API returned 401',
    )
  })

  it('throws when the payload does not match the font schema', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: 1 }))

    await expect(fetchUntitledSerifFont({ appKey: 'test-key' })).rejects.toThrow(
      'Fonts API returned an unexpected payload',
    )
  })

  it('throws when the API family is not Untitled Serif', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ ...UNTITLED_SERIF_FONT, family: 'Inter' }))

    await expect(fetchUntitledSerifFont({ appKey: 'test-key' })).rejects.toThrow(
      'Fonts API returned an unexpected payload',
    )
  })
})
