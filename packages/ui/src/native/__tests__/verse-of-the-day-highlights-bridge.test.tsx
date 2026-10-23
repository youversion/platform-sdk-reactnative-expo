/**
 * VerseOfTheDay subscribes at Highlight Scope and paints with native text.
 * Scripture stays unmounted until today's passage id is known. The card does
 * not hand highlights to a WebView, and it does not apply or remove them.
 */
import { render, waitFor } from '@testing-library/react-native'
import type { Highlight, UseHighlightsOptions } from '@youversion/platform-react-native-expo-core'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Platform, Share } from 'react-native'

import en from '../../i18n/locales/en.json'
import { emptyHighlights } from '../../test-utils/default-hook-overrides'
import { resetImpls } from '../../test-utils/install-test-impls'
import {
  installBibleContentFetch,
  type BibleContentFetchStub,
} from '../../test-utils/stub-bible-content-fetch'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { VerseOfTheDay } from '../verse-of-the-day'
import * as votdPassage from '../use-verse-of-the-day-passage-id'
import * as votdShare from '../use-verse-of-the-day-share-source'

const YELLOW = 'fffe00'

function highlight(passageId: string, versionId = 111): Highlight {
  return { version_id: versionId, passage_id: passageId, color: YELLOW }
}

const useHighlightsMock = jest.fn(emptyHighlights)
const useVerseOfTheDayPassageIdSpy = jest.spyOn(votdPassage, 'useVerseOfTheDayPassageId')
const useVerseOfTheDayShareSourceSpy = jest.spyOn(votdShare, 'useVerseOfTheDayShareSource')
const idleRetry = jest.fn()

function passageLookup(
  passageId: string | null,
): ReturnType<typeof votdPassage.useVerseOfTheDayPassageId> {
  if (passageId == null) {
    return { passageId: null, status: 'loading', retry: idleRetry }
  }
  return { passageId, status: 'ready', retry: idleRetry }
}

function stubHighlights(highlights: Highlight[]) {
  useHighlightsMock.mockImplementation((options: UseHighlightsOptions) => ({
    ...emptyHighlights(options),
    highlights: options.enabled === false ? [] : highlights,
  }))
}

const wrapper = youVersionProviderWrapper('light', undefined, {
  useHighlights: useHighlightsMock,
})

let fetchStub: BibleContentFetchStub

beforeEach(() => {
  fetchStub = installBibleContentFetch()
  useHighlightsMock.mockClear()
  stubHighlights([])
  useVerseOfTheDayPassageIdSpy.mockReturnValue(passageLookup(null))
  useVerseOfTheDayShareSourceSpy.mockReturnValue({
    shareSource: null,
    loadShareSource: () => Promise.resolve(null),
  })
  jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' })
})

afterEach(() => {
  fetchStub.restore()
  resetImpls()
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    enumerable: true,
    value: 'ios',
  })
})

afterAll(() => {
  useVerseOfTheDayPassageIdSpy.mockRestore()
  useVerseOfTheDayShareSourceSpy.mockRestore()
})

describe('native scripture', () => {
  it('does not show a verse until the passage id is known', () => {
    const { queryByText, queryByTestId } = render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(queryByText('For God so loved')).toBeNull()
    expect(queryByTestId('scripture-passage')).toBeNull()
    expect(useHighlightsMock).toHaveBeenCalledWith({
      versionId: 1,
      book: '_',
      chapter: '0',
      enabled: false,
    })
    expect(fetchStub.urls.some((url) => url.includes('/passages/'))).toBe(false)
  })

  it('draws the verse while a highlight for that verse is in scope', async () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue(passageLookup('JHN.3.16'))
    stubHighlights([highlight('JHN.3.16')])
    const { getByText } = render(<VerseOfTheDay versionId={111} />, { wrapper })

    await waitFor(() => {
      expect(getByText('For God so loved')).toBeTruthy()
    })
    expect(useHighlightsMock).toHaveBeenCalledWith({
      versionId: 111,
      book: 'JHN',
      chapter: '3',
      enabled: true,
    })
  })

  it('draws the verse when nothing is highlighted', async () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue(passageLookup('JHN.3.16'))
    const { getByText } = render(<VerseOfTheDay versionId={111} />, { wrapper })

    await waitFor(() => {
      expect(getByText('For God so loved')).toBeTruthy()
    })
  })

  it('requests the looked-up chapter', async () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue(passageLookup('JHN.3.16'))
    render(<VerseOfTheDay versionId={111} />, { wrapper })

    await waitFor(() => {
      expect(fetchStub.urls.some((url) => url.includes('/v1/bibles/111/passages/JHN.3'))).toBe(true)
    })
    expect(fetchStub.urls.some((url) => url.includes('dayOfYear'))).toBe(false)
  })
})

describe('the highlights subscription scope', () => {
  it('calls useHighlights with enabled: false until the passage id is known', () => {
    render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(useHighlightsMock).toHaveBeenCalledWith({
      versionId: 1,
      book: '_',
      chapter: '0',
      enabled: false,
    })
  })

  it('does not request a passage while the passage id is unknown', () => {
    stubHighlights([highlight('JHN.3.16'), highlight('MAT.5.1')])
    const { queryByText } = render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(queryByText('For God so loved')).toBeNull()
    expect(fetchStub.urls.some((url) => url.includes('/passages/'))).toBe(false)
    expect(useHighlightsMock).toHaveBeenCalledWith({
      versionId: 1,
      book: '_',
      chapter: '0',
      enabled: false,
    })
  })

  it('subscribes at Highlight Scope from the passage id once it is known', async () => {
    const { rerender } = render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(useHighlightsMock).toHaveBeenCalledWith({
      versionId: 1,
      book: '_',
      chapter: '0',
      enabled: false,
    })

    useVerseOfTheDayPassageIdSpy.mockReturnValue(passageLookup('JHN.1'))
    rerender(<VerseOfTheDay versionId={111} />)

    expect(useHighlightsMock).toHaveBeenLastCalledWith({
      versionId: 111,
      book: 'JHN',
      chapter: '1',
      enabled: true,
    })
    await waitFor(() => {
      expect(fetchStub.urls.some((url) => url.includes('/passages/JHN.1'))).toBe(true)
    })
  })

  it('shows the passage as unavailable and does not fetch when the passage id is invalid USFM', () => {
    useVerseOfTheDayPassageIdSpy.mockReturnValue(passageLookup('not-usfm'))
    stubHighlights([highlight('JHN.3.16')])
    const { getByText, queryByText } = render(<VerseOfTheDay versionId={111} />, { wrapper })

    expect(getByText(en.passageUnavailable)).toBeTruthy()
    expect(queryByText('For God so loved')).toBeNull()
    expect(useHighlightsMock).toHaveBeenCalledWith({
      versionId: 1,
      book: '_',
      chapter: '0',
      enabled: false,
    })
    expect(fetchStub.urls.some((url) => url.includes('/passages/'))).toBe(false)
  })
})

describe('native scripture ownership', () => {
  const votdSource = readFileSync(join(__dirname, '../verse-of-the-day.tsx'), 'utf8')

  it('draws scripture with PassageEmbed and does not apply highlights', () => {
    expect(votdSource).toContain('PassageEmbed')
    expect(votdSource).not.toContain('BibleTextViewDom')
    expect(votdSource).not.toContain("from '../dom/verse-of-the-day'")
    expect(votdSource).not.toContain('onHighlightApply')
    expect(votdSource).not.toContain('onHighlightRemove')
    expect(votdSource).not.toContain('accessToken')
  })
})
