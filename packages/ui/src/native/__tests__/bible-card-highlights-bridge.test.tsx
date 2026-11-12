/**
 * BibleCard subscribes at Highlight Scope and paints with native text.
 * It does not hand highlights to a WebView, and it does not apply or remove them.
 */
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import type { Highlight, UseHighlightsOptions } from '@youversion/platform-react-native-expo-core'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { StyleSheet, Text } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import { BIBLE_CARD_VERSION_PERSIST_KEY } from '../../lib/constants'
import {
  bibleCardVersionStoreInitialState,
  useBibleCardVersionStore,
} from '../../stores/bible-card-version-store'
import en from '../../i18n/locales/en.json'
import { emptyHighlights } from '../../test-utils/default-hook-overrides'
import { resetImpls, stubImpl } from '../../test-utils/install-test-impls'
import {
  installBibleContentFetch,
  type BibleContentFetchStub,
} from '../../test-utils/stub-bible-content-fetch'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleCard } from '../bible-card'
import * as bibleCardMetadata from '../bible-card-metadata'

const YELLOW = 'fffe00'
const YELLOW_HEX = '#fffe00'
const JOHN = 'For God so loved'

function highlight(passageId: string, versionId = 111): Highlight {
  return { version_id: versionId, passage_id: passageId, color: YELLOW }
}

const useHighlightsMock = jest.fn(emptyHighlights)

function stubHighlights(highlights: Highlight[]) {
  useHighlightsMock.mockImplementation((options: UseHighlightsOptions) => ({
    ...emptyHighlights(options),
    highlights: options.enabled === false ? [] : highlights,
  }))
}

type Rendered = ReturnType<typeof render>

function paintHighlight(sentence: string, root: Rendered): void {
  const paragraph = root.UNSAFE_getAllByType(Text).find((node) => node.props.onTextLayout)
  if (paragraph === undefined) {
    throw new Error('missing paragraph layout')
  }
  fireEvent(paragraph, 'textLayout', {
    nativeEvent: {
      lines: [
        {
          text: sentence,
          x: 0,
          y: 0,
          width: 240,
          height: 32,
          ascender: 24,
          descender: -6,
          capHeight: 18,
          xHeight: 12,
        },
      ],
    },
  })
  let parent: ReactTestInstance | null = paragraph.parent
  while (parent !== null) {
    if (parent.props.onLayout !== undefined) {
      fireEvent(parent, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 40 } },
      })
      return
    }
    parent = parent.parent
  }
  throw new Error('missing block layout')
}

function hasPaint(root: Rendered, color: string): boolean {
  return root.UNSAFE_getAllByType(Text).some((node) => {
    return StyleSheet.flatten(node.props.style)?.backgroundColor === color
  })
}

const wrapper = youVersionProviderWrapper('light', undefined, {
  useHighlights: useHighlightsMock,
})

let fetchStub: BibleContentFetchStub

beforeEach(async () => {
  fetchStub = installBibleContentFetch()
  useHighlightsMock.mockClear()
  stubHighlights([])
  stubImpl('FootnoteContent', 'mock-footnote')
  stubImpl('BibleVersionPickerSheet', 'mock-version-picker-sheet')
  stubImpl('NativeSheet')
  jest
    .spyOn(bibleCardMetadata, 'getBibleCardMetadata')
    .mockReturnValue(new Promise(() => undefined))
  mmkvStorage.remove(BIBLE_CARD_VERSION_PERSIST_KEY)
  useBibleCardVersionStore.setState(bibleCardVersionStoreInitialState)
  await useBibleCardVersionStore.persist.rehydrate()
})

afterEach(() => {
  fetchStub.restore()
  resetImpls()
  jest.restoreAllMocks()
})

describe('native scripture', () => {
  it('paints a highlight for the verse and clears it when the cache drops it', async () => {
    stubHighlights([highlight('JHN.3.16')])
    const screen = render(<BibleCard reference="JHN.3.16" versionId={111} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(JOHN)).toBeTruthy()
    })
    paintHighlight(JOHN, screen)
    await waitFor(() => {
      expect(hasPaint(screen, YELLOW_HEX)).toBe(true)
    })

    stubHighlights([])
    screen.rerender(<BibleCard reference="JHN.3.16" versionId={111} />)

    await waitFor(() => {
      expect(hasPaint(screen, YELLOW_HEX)).toBe(false)
    })
  })

  it('draws the verse when nothing is highlighted', async () => {
    const screen = render(<BibleCard reference="JHN.3.16" versionId={111} />, { wrapper })

    await waitFor(() => {
      expect(screen.getByText(JOHN)).toBeTruthy()
    })
    expect(hasPaint(screen, YELLOW_HEX)).toBe(false)
  })
})

describe('the highlights subscription scope', () => {
  it('subscribes at Highlight Scope for a verse-range USFM', async () => {
    const { getByText } = render(<BibleCard reference="JHN.1.1-4" versionId={111} />, { wrapper })

    expect(useHighlightsMock).toHaveBeenCalledWith({
      versionId: 111,
      book: 'JHN',
      chapter: '1',
      enabled: true,
    })
    await waitFor(() => {
      expect(getByText('In the beginning')).toBeTruthy()
    })
  })

  it('re-scopes when the native versionId changes', async () => {
    const onVersionChange = jest.fn()
    const { getByText, rerender } = render(
      <BibleCard reference="JHN.3.16" versionId={111} onVersionChange={onVersionChange} />,
      { wrapper },
    )

    expect(useHighlightsMock).toHaveBeenLastCalledWith({
      versionId: 111,
      book: 'JHN',
      chapter: '3',
      enabled: true,
    })
    await waitFor(() => {
      expect(getByText('For God so loved')).toBeTruthy()
    })

    rerender(<BibleCard reference="JHN.3.16" versionId={222} onVersionChange={onVersionChange} />)

    expect(useHighlightsMock).toHaveBeenLastCalledWith({
      versionId: 222,
      book: 'JHN',
      chapter: '3',
      enabled: true,
    })
    await waitFor(() => {
      expect(fetchStub.urls.some((url) => url.includes('/v1/bibles/222/passages/JHN.3'))).toBe(true)
    })
  })

  it('shows the passage as unavailable and does not fetch when the USFM is invalid', () => {
    const { getByText, queryByText } = render(<BibleCard reference="not-usfm" versionId={111} />, {
      wrapper,
    })

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
  const cardSource = readFileSync(join(__dirname, '../bible-card.tsx'), 'utf8')

  it('draws scripture with PassageEmbed and does not apply highlights', () => {
    expect(cardSource).toContain('PassageEmbed')
    expect(cardSource).not.toContain('BibleTextViewDom')
    expect(cardSource).not.toContain("from '../dom/bible-card'")
    expect(cardSource).not.toContain('onHighlightApply')
    expect(cardSource).not.toContain('onHighlightRemove')
    expect(cardSource).not.toContain('accessToken')
  })
})
