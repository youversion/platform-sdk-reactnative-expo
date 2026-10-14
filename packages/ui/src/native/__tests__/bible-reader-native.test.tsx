import type { FetchBibleContent } from '@youversion/platform-react-native-expo-core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { BibleReaderVerseSelection } from '@youversion/platform-react-ui'
import type { ComponentProps } from 'react'
import type { ReactTestInstance } from 'react-test-renderer'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReaderNative } from '../bible-reader-native'
import type { BibleReaderVerseFocus } from '../bible-reader-navigation'

const VERSION_ID = 3034
const UNAVAILABLE = 'This passage is unavailable in the selected Bible version.'
const REQUEST_FAILED = 'This request can’t be completed right now.'

const JOHN_1: BibleReaderVerseSelection = {
  versionId: VERSION_ID,
  book: 'JHN',
  chapter: '1',
  verses: [1],
  passageIds: ['JHN.1.1'],
  reference: 'JHN 1:1',
  shareData: {
    text: '“In the beginning”\n\nJHN 1:1',
    reference: 'JHN 1:1',
    verseText: 'In the beginning',
    verses: [1],
    book: 'JHN',
    chapter: '1',
    versionId: VERSION_ID,
  },
}

const CLEARED: BibleReaderVerseSelection = {
  versionId: VERSION_ID,
  book: 'JHN',
  chapter: '2',
  verses: [],
  passageIds: [],
  reference: '',
  shareData: null,
}

const FOCUS: BibleReaderVerseFocus = {
  seq: 1,
  versionId: VERSION_ID,
  passageId: 'JHN.1.1',
  scrollsToVerse: true,
  shouldFocus: true,
}

function chapterBody(sentence: string): string {
  const html =
    '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>' +
    `${sentence}</div></div>`
  return JSON.stringify({ content: html, reference: 'John 1' })
}

function fetchVersions(versions: Record<number, { sentence: string }>): FetchBibleContent {
  return async ({ path }) => {
    const passageMatch = /\/passages\/[^.]+\.([^?]+)/.exec(path)
    const versionId = /\/v1\/bibles\/(\d+)\//.exec(path)
    const version = versionId === null ? undefined : versions[Number(versionId[1])]
    const chapter = passageMatch?.[1]
    if (version === undefined || chapter !== '1') {
      return { status: 404, body: '', contentType: 'application/json' }
    }
    return {
      status: 200,
      body: chapterBody(version.sentence),
      contentType: 'application/json',
    }
  }
}

/** A fetch target as a URL string. A `Request` stringifies to `[object Object]`. */
function fetchUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) {
    return input.href
  }
  if (input instanceof Request) {
    return input.url
  }
  return input
}

/** Version names load through the provider's fetch, separate from the chapter prop. */
function stubVersionNames(names: Record<number, string>): () => void {
  const prior = global.fetch
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = fetchUrl(input)
    const match = /\/v1\/bibles\/(\d+)(?:\?|$)/.exec(url)
    if (match !== null && !url.includes('/books')) {
      const abbreviation = names[Number(match[1])]
      if (abbreviation !== undefined) {
        return Promise.resolve(
          new Response(JSON.stringify({ abbreviation, language_tag: 'en' }), {
            status: 200,
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
          }),
        )
      }
    }
    return prior(input, init)
  })
  return () => {
    global.fetch = prior
  }
}

function fetchChapters(
  chapters: Record<string, { status: number; sentence?: string }>,
): FetchBibleContent {
  return async ({ path }) => {
    const match = /\/passages\/[^.]+\.([^?]+)/.exec(path)
    const chapter = match?.[1]
    const spec = chapter === undefined ? undefined : chapters[chapter]
    if (spec === undefined || spec.status !== 200) {
      return {
        status: spec?.status ?? 404,
        body: '',
        contentType: 'application/json',
      }
    }
    return {
      status: 200,
      body: chapterBody(spec.sentence ?? ''),
      contentType: 'application/json',
    }
  }
}

type ReaderOverrides = Partial<
  Omit<ComponentProps<typeof BibleReaderNative>, 'includeAuth' | 'authRedirectUrl'>
>

function mount(overrides: ReaderOverrides = {}) {
  const props: ComponentProps<typeof BibleReaderNative> = {
    appKey: 'test-key',
    apiHost: 'https://api.youversion.com',
    installationId: 'test-install',
    fetchBibleContent: fetchChapters({
      '1': { status: 200, sentence: 'In the beginning' },
      '2': { status: 200, sentence: 'The earth was' },
    }),
    highlights: [],
    verseActions: 'none',
    locale: 'en',
    book: 'JHN',
    chapter: '1',
    versionId: VERSION_ID,
    includeAuth: false,
    ...overrides,
  }
  const view = render(<BibleReaderNative {...props} />, {
    wrapper: youVersionProviderWrapper(),
  })
  return {
    update(next: ReaderOverrides) {
      Object.assign(props, next)
      view.rerender(<BibleReaderNative {...props} />)
    },
  }
}

function pressVerse(text: string): void {
  const nodes = screen.getAllByText(text)
  for (const node of nodes) {
    let current: ReactTestInstance | null = node
    while (current !== null) {
      if (current.props.onPress !== undefined) {
        fireEvent.press(current)
        return
      }
      current = current.parent
    }
  }
  throw new Error(`no pressable ancestor for ${text}`)
}

describe('BibleReaderNative', () => {
  it('reports the verse when its text is tapped', async () => {
    const onVerseSelect = jest.fn()
    mount({ onVerseSelect })

    await screen.findByText('In the beginning')
    pressVerse('In the beginning')

    expect(onVerseSelect).toHaveBeenCalledWith(JOHN_1)
  })

  it('clears the selection when the chapter changes', async () => {
    const onVerseSelect = jest.fn()
    const reader = mount({ onVerseSelect })

    await screen.findByText('In the beginning')
    pressVerse('In the beginning')
    expect(onVerseSelect).toHaveBeenCalledWith(JOHN_1)

    reader.update({ chapter: '2' })
    await screen.findByText('The earth was')

    expect(onVerseSelect).toHaveBeenLastCalledWith(CLEARED)
  })

  it('does not relabel the open selection when a visited version is chosen', async () => {
    const otherId = 111
    const restoreNames = stubVersionNames({
      [VERSION_ID]: 'BSB',
      [otherId]: 'RVR',
    })
    const onVerseSelect = jest.fn()
    try {
      const reader = mount({
        onVerseSelect,
        fetchBibleContent: fetchVersions({
          [VERSION_ID]: { sentence: 'In the beginning' },
          [otherId]: { sentence: 'Al principio' },
        }),
      })

      await screen.findByText('In the beginning')
      reader.update({ versionId: otherId })
      await screen.findByText('Al principio')
      reader.update({ versionId: VERSION_ID })
      await screen.findByText('In the beginning')
      pressVerse('In the beginning')

      const before = onVerseSelect.mock.calls.length
      reader.update({ versionId: otherId })
      await screen.findByText('Al principio')

      // SAFETY: the reader only calls onVerseSelect with a BibleReaderVerseSelection.
      const duringSwitch = onVerseSelect.mock.calls
        .slice(before)
        .map((call) => call[0] as BibleReaderVerseSelection)
      const stillSelected = duringSwitch.filter((selection) => selection.verses.length > 0)
      expect(stillSelected).toEqual([])
      expect(duringSwitch.at(-1)).toEqual({
        versionId: otherId,
        book: 'JHN',
        chapter: '1',
        verses: [],
        passageIds: [],
        reference: '',
        shareData: null,
      })
    } finally {
      restoreNames()
    }
  })

  it('resends the selection once the version name arrives', async () => {
    let releaseName = () => {}
    const nameArrives = new Promise<void>((resolve) => {
      releaseName = resolve
    })
    const prior = global.fetch
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = fetchUrl(input)
      if (/\/v1\/bibles\/\d+(?:\?|$)/.test(url) && !url.includes('/books')) {
        return nameArrives.then(
          () =>
            new Response(JSON.stringify({ abbreviation: 'BSB', language_tag: 'en' }), {
              status: 200,
              headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
            }),
        )
      }
      return prior(input, init)
    })
    const onVerseSelect = jest.fn()
    try {
      mount({ onVerseSelect })

      await screen.findByText('In the beginning')
      pressVerse('In the beginning')
      expect(onVerseSelect).toHaveBeenCalledWith(JOHN_1)

      releaseName()
      await waitFor(() => {
        expect(onVerseSelect).toHaveBeenLastCalledWith({
          ...JOHN_1,
          shareData: {
            ...JOHN_1.shareData,
            reference: 'JHN 1:1 BSB',
            text: '“In the beginning”\n\nJHN 1:1 BSB',
          },
        })
      })
    } finally {
      global.fetch = prior
    }
  })

  it('reports a verse focus once the chapter is on screen', async () => {
    const onVerseFocusApplied = jest.fn()
    const reader = mount()

    await screen.findByText('In the beginning')
    reader.update({ verseFocus: FOCUS, onVerseFocusApplied })

    await waitFor(() => {
      expect(onVerseFocusApplied).toHaveBeenCalledWith({ stream: 0, seq: 1 })
    })
  })

  it('waits to focus until the requested version is on screen', async () => {
    const otherId = 111
    const onVerseFocusApplied = jest.fn()
    const reader = mount({
      onVerseFocusApplied,
      fetchBibleContent: fetchVersions({
        [VERSION_ID]: { sentence: 'In the beginning' },
        [otherId]: { sentence: 'Al principio' },
      }),
    })

    await screen.findByText('In the beginning')
    reader.update({ verseFocus: { ...FOCUS, versionId: otherId } })

    // Landing retries for half a second. Waiting past that shows the old version never reports.
    await new Promise((resolve) => {
      setTimeout(resolve, 700)
    })
    expect(onVerseFocusApplied).not.toHaveBeenCalled()

    reader.update({ versionId: otherId })
    await screen.findByText('Al principio')
    await waitFor(() => {
      expect(onVerseFocusApplied).toHaveBeenCalledWith({ stream: 0, seq: 1 })
    })
  })

  it('does not report a verse focus after the chapter changes', async () => {
    const onVerseFocusApplied = jest.fn()
    const reader = mount()

    await screen.findByText('In the beginning')
    reader.update({ verseFocus: FOCUS, onVerseFocusApplied })
    reader.update({ chapter: '2' })
    await screen.findByText('The earth was')

    // Landing retries for half a second. Waiting past that shows a cancelled focus never reports.
    await new Promise((resolve) => {
      setTimeout(resolve, 700)
    })

    expect(onVerseFocusApplied).not.toHaveBeenCalled()
    expect(screen.queryByText('In the beginning')).toBeNull()
  })

  it('shows the unavailable message without Retry for a missing chapter, and Retry when the request fails', async () => {
    mount({
      fetchBibleContent: fetchChapters({ '1': { status: 404 } }),
    })

    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy()
    expect(screen.queryByText('Retry')).toBeNull()

    mount({
      fetchBibleContent: fetchChapters({ '1': { status: 503 } }),
    })

    expect(await screen.findByText(REQUEST_FAILED)).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()
  })
})
