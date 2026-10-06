/**
 * Layer 1 — native BibleCard chrome payload from the Bible Content Client.
 */
import type { FetchBibleContent } from '@youversion/platform-react-native-expo-core'

import { getBibleCardMetadata } from '../bible-card-metadata'

const PASSAGE_PATH = '/v1/bibles/3034/passages/JHN.3.16?format=text'
const VERSION_PATH = '/v1/bibles/3034'

function fetchBibleContent(
  responses: Record<string, { status: number; body: string }>,
): FetchBibleContent {
  return async ({ path }) => {
    const response = responses[path]
    if (response === undefined) {
      throw new Error(`Unexpected Bible Content path: ${path}`)
    }
    return { ...response, contentType: 'application/json' }
  }
}

describe('getBibleCardMetadata', () => {
  it('builds chrome metadata from the text passage and version', async () => {
    const source = await getBibleCardMetadata(
      fetchBibleContent({
        [PASSAGE_PATH]: {
          status: 200,
          body: JSON.stringify({
            id: 'JHN.3.16',
            content: 'For God so loved the world...',
            reference: 'John 3:16',
          }),
        },
        [VERSION_PATH]: {
          status: 200,
          body: JSON.stringify({
            localized_abbreviation: 'NIV',
            copyright: 'NIV copyright',
            language_tag: 'en',
          }),
        },
      }),
      3034,
      'JHN.3.16',
    )

    expect(source).toEqual({
      reference: 'John 3:16',
      abbreviation: 'NIV',
      copyright: 'NIV copyright',
      languageTag: 'en',
    })
  })

  it('keeps the version chrome when the passage lookup fails', async () => {
    const source = await getBibleCardMetadata(
      fetchBibleContent({
        [PASSAGE_PATH]: { status: 500, body: 'nope' },
        [VERSION_PATH]: {
          status: 200,
          body: JSON.stringify({
            localized_abbreviation: 'NIV',
            copyright: 'NIV copyright',
            language_tag: 'en',
          }),
        },
      }),
      3034,
      'JHN.3.16',
    )

    expect(source).toEqual({
      reference: undefined,
      abbreviation: 'NIV',
      copyright: 'NIV copyright',
      languageTag: 'en',
    })
  })

  it('keeps the passage reference when the version lookup fails', async () => {
    const source = await getBibleCardMetadata(
      fetchBibleContent({
        [PASSAGE_PATH]: {
          status: 200,
          body: JSON.stringify({
            content: 'For God so loved the world...',
            reference: 'John 3:16',
          }),
        },
        [VERSION_PATH]: { status: 404, body: 'missing' },
      }),
      3034,
      'JHN.3.16',
    )

    expect(source).toEqual({
      reference: 'John 3:16',
      abbreviation: undefined,
      copyright: undefined,
      languageTag: undefined,
    })
  })

  it('returns null when both lookups fail', async () => {
    const source = await getBibleCardMetadata(
      fetchBibleContent({
        [PASSAGE_PATH]: { status: 500, body: 'nope' },
        [VERSION_PATH]: { status: 500, body: 'nope' },
      }),
      3034,
      'JHN.3.16',
    )

    expect(source).toBeNull()
  })

  it('returns null when both bodies are not JSON', async () => {
    const source = await getBibleCardMetadata(
      fetchBibleContent({
        [PASSAGE_PATH]: { status: 200, body: '<html>' },
        [VERSION_PATH]: { status: 200, body: '<html>' },
      }),
      3034,
      'JHN.3.16',
    )

    expect(source).toBeNull()
  })

  it('treats a null copyright as missing', async () => {
    const source = await getBibleCardMetadata(
      fetchBibleContent({
        [PASSAGE_PATH]: {
          status: 200,
          body: JSON.stringify({ reference: 'John 3:16' }),
        },
        [VERSION_PATH]: {
          status: 200,
          body: JSON.stringify({
            localized_abbreviation: 'NIV',
            copyright: null,
            language_tag: 'en',
          }),
        },
      }),
      3034,
      'JHN.3.16',
    )

    expect(source).toEqual({
      reference: 'John 3:16',
      abbreviation: 'NIV',
      copyright: undefined,
      languageTag: 'en',
    })
  })

  it('encodes the passage id on the Bible Content path', async () => {
    const fetchMock: jest.MockedFunction<FetchBibleContent> = jest.fn()
    fetchMock.mockResolvedValue({
      status: 404,
      body: '',
      contentType: null,
    })

    await getBibleCardMetadata(fetchMock, 111, 'JHN.3.16-18')

    expect(fetchMock).toHaveBeenCalledWith({
      path: '/v1/bibles/111/passages/JHN.3.16-18?format=text',
    })
    expect(fetchMock).toHaveBeenCalledWith({
      path: '/v1/bibles/111',
    })
  })

  it('returns null and does not fetch when the version is excluded', async () => {
    const fetchMock: jest.MockedFunction<FetchBibleContent> = jest.fn()

    const source = await getBibleCardMetadata(fetchMock, 3034, 'JHN.3.16', {
      excludedVersionIds: [3034],
    })

    expect(source).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null and does not fetch when the version is not in the permit list', async () => {
    const fetchMock: jest.MockedFunction<FetchBibleContent> = jest.fn()

    const source = await getBibleCardMetadata(fetchMock, 3034, 'JHN.3.16', {
      permittedVersionIds: [111],
    })

    expect(source).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null for an empty permit list without fetching', async () => {
    const fetchMock: jest.MockedFunction<FetchBibleContent> = jest.fn()

    const source = await getBibleCardMetadata(fetchMock, 3034, 'JHN.3.16', {
      permittedVersionIds: [],
    })

    expect(source).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null when the version language is not permitted', async () => {
    const paths: string[] = []
    const fetch: FetchBibleContent = async ({ path }) => {
      paths.push(path)
      if (path === VERSION_PATH) {
        return {
          status: 200,
          body: JSON.stringify({
            localized_abbreviation: 'NVI',
            copyright: 'NVI copyright',
            language_tag: 'es',
          }),
          contentType: 'application/json',
        }
      }
      throw new Error(`Unexpected Bible Content path: ${path}`)
    }

    const source = await getBibleCardMetadata(fetch, 3034, 'JHN.3.16', {
      permittedLanguageTags: ['en'],
    })

    expect(source).toBeNull()
    expect(paths).toEqual([VERSION_PATH])
  })
})
