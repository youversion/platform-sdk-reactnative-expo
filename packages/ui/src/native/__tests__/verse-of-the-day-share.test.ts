/**
 * Layer 1 — native VOTD chrome/share payload from the Bible Content Client.
 */
import type { FetchBibleContent } from '@youversion/platform-react-native-expo-core'

import { getVerseOfTheDayShareSource } from '../verse-of-the-day-share'

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

describe('getVerseOfTheDayShareSource', () => {
  it('builds share data from the text passage and version abbreviation', async () => {
    const source = await getVerseOfTheDayShareSource(
      fetchBibleContent({
        [PASSAGE_PATH]: {
          status: 200,
          body: JSON.stringify({
            id: 'JHN.3.16',
            content: '  For God so loved the world...  ',
            reference: 'John 3:16',
          }),
        },
        [VERSION_PATH]: {
          status: 200,
          body: JSON.stringify({ localized_abbreviation: 'NIV' }),
        },
      }),
      3034,
      'JHN.3.16',
    )

    expect(source).toEqual({
      verseText: 'For God so loved the world...',
      reference: 'John 3:16 NIV',
      text: 'For God so loved the world...\n\nJohn 3:16 NIV',
    })
  })

  it('uses the passage reference alone when the version lookup fails', async () => {
    const source = await getVerseOfTheDayShareSource(
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
      verseText: 'For God so loved the world...',
      reference: 'John 3:16',
      text: 'For God so loved the world...\n\nJohn 3:16',
    })
  })

  it('uses the passage reference alone when the version lookup throws', async () => {
    const fetchMock: FetchBibleContent = async ({ path }) => {
      if (path === VERSION_PATH) {
        throw new Error('timeout')
      }
      return fetchBibleContent({
        [PASSAGE_PATH]: {
          status: 200,
          body: JSON.stringify({
            content: 'For God so loved the world...',
            reference: 'John 3:16',
          }),
        },
      })({ path })
    }

    const source = await getVerseOfTheDayShareSource(fetchMock, 3034, 'JHN.3.16')

    expect(source).toEqual({
      verseText: 'For God so loved the world...',
      reference: 'John 3:16',
      text: 'For God so loved the world...\n\nJohn 3:16',
    })
  })

  it('uses the passage reference alone when the version body is not JSON', async () => {
    const source = await getVerseOfTheDayShareSource(
      fetchBibleContent({
        [PASSAGE_PATH]: {
          status: 200,
          body: JSON.stringify({
            content: 'For God so loved the world...',
            reference: 'John 3:16',
          }),
        },
        [VERSION_PATH]: { status: 200, body: '<html>' },
      }),
      3034,
      'JHN.3.16',
    )

    expect(source).toEqual({
      verseText: 'For God so loved the world...',
      reference: 'John 3:16',
      text: 'For God so loved the world...\n\nJohn 3:16',
    })
  })

  it('returns null when the passage lookup is not ok', async () => {
    const source = await getVerseOfTheDayShareSource(
      fetchBibleContent({
        [PASSAGE_PATH]: { status: 500, body: 'nope' },
        [VERSION_PATH]: { status: 200, body: '{}' },
      }),
      3034,
      'JHN.3.16',
    )

    expect(source).toBeNull()
  })

  it('returns null when the passage body is not JSON', async () => {
    const source = await getVerseOfTheDayShareSource(
      fetchBibleContent({
        [PASSAGE_PATH]: { status: 200, body: '<html>' },
        [VERSION_PATH]: { status: 200, body: '{}' },
      }),
      3034,
      'JHN.3.16',
    )

    expect(source).toBeNull()
  })

  it('encodes the passage id on the Bible Content path', async () => {
    const fetchMock: jest.MockedFunction<FetchBibleContent> = jest.fn()
    fetchMock.mockResolvedValue({
      status: 404,
      body: '',
      contentType: null,
    })

    await getVerseOfTheDayShareSource(fetchMock, 111, 'JHN.3.16-18')

    expect(fetchMock).toHaveBeenCalledWith({
      path: '/v1/bibles/111/passages/JHN.3.16-18?format=text',
    })
  })
})
