import type { FetchBibleContent } from '@youversion/platform-react-native-expo-core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { BibleReaderVerseSelection } from '@youversion/platform-react-ui'
import type { ComponentProps } from 'react'
import { ScrollView, StyleSheet, Text, type ColorValue, type TextStyle } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReaderNative } from '../bible-reader-native'
import type { BibleReaderVerseFocus } from '../bible-reader-navigation'
import { parsePassage } from '../scripture/parse-passage'

const VERSION_ID = 3034
const UNAVAILABLE = 'This passage is unavailable in the selected Bible version.'
const REQUEST_FAILED = 'This request can’t be completed right now.'
const OFFLINE = 'We’re having difficulties with your connection.'

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

const JOHN_LABELED: BibleReaderVerseSelection = {
  ...JOHN_1,
  reference: 'John 1:1',
  shareData: {
    text: '“In the beginning”\n\nJohn 1:1 BSB',
    reference: 'John 1:1 BSB',
    verseText: 'In the beginning',
    verses: [1],
    book: 'JHN',
    chapter: '1',
    versionId: VERSION_ID,
  },
}

const OTHER_UNLABELED: BibleReaderVerseSelection = {
  versionId: 112,
  book: 'JHN',
  chapter: '1',
  verses: [1],
  passageIds: ['JHN.1.1'],
  reference: 'JHN 1:1',
  shareData: {
    text: '“Al principio”\n\nJHN 1:1',
    reference: 'JHN 1:1',
    verseText: 'Al principio',
    verses: [1],
    book: 'JHN',
    chapter: '1',
    versionId: 112,
  },
}

const OTHER_LABELED: BibleReaderVerseSelection = {
  versionId: 112,
  book: 'JHN',
  chapter: '1',
  verses: [1],
  passageIds: ['JHN.1.1'],
  reference: 'Juan 1:1',
  shareData: {
    text: '“Al principio”\n\nJuan 1:1 RVR',
    reference: 'Juan 1:1 RVR',
    verseText: 'Al principio',
    verses: [1],
    book: 'JHN',
    chapter: '1',
    versionId: 112,
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

const CLEARED_CHAPTER: BibleReaderVerseSelection = {
  versionId: VERSION_ID,
  book: 'JHN',
  chapter: '1',
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
function metadataResponse(body: string): Promise<Response> {
  return Promise.resolve(
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    }),
  )
}

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
function stubVersionNames(
  names: Record<number, string>,
  languageTags: Record<number, string> = {},
): () => void {
  const prior = global.fetch
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = fetchUrl(input)
    const match = /\/v1\/bibles\/(\d+)(?:\?|$)/.exec(url)
    if (match !== null && !url.includes('/books')) {
      const abbreviation = names[Number(match[1])]
      if (abbreviation !== undefined) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              abbreviation,
              language_tag: languageTags[Number(match[1])] ?? 'en',
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
            },
          ),
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

  it('does not label a new selection with the previous version name', async () => {
    const otherId = 112
    let releaseOther = () => {}
    const otherArrives = new Promise<void>((resolve) => {
      releaseOther = resolve
    })
    const prior = global.fetch
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = fetchUrl(input)
      const versionMatch = /\/v1\/bibles\/(\d+)(?:\?|$)/.exec(url)
      if (versionMatch !== null && !url.includes('/books')) {
        const id = Number(versionMatch[1])
        if (id === VERSION_ID) {
          return metadataResponse(JSON.stringify({ abbreviation: 'BSB', language_tag: 'en' }))
        }
        if (id === otherId) {
          return otherArrives.then(() =>
            metadataResponse(JSON.stringify({ abbreviation: 'RVR', language_tag: 'es' })),
          )
        }
      }
      const booksMatch = /\/v1\/bibles\/(\d+)\/books(?:\?|$)/.exec(url)
      if (booksMatch !== null) {
        const id = Number(booksMatch[1])
        if (id === VERSION_ID) {
          return metadataResponse(
            JSON.stringify({
              data: [{ id: 'JHN', title: 'John', chapters: [{ id: '1', title: '1' }] }],
            }),
          )
        }
        if (id === otherId) {
          return otherArrives.then(() =>
            metadataResponse(
              JSON.stringify({
                data: [{ id: 'JHN', title: 'Juan', chapters: [{ id: '1', title: '1' }] }],
              }),
            ),
          )
        }
      }
      return prior(input, init)
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
      pressVerse('In the beginning')
      await waitFor(() => {
        expect(onVerseSelect).toHaveBeenLastCalledWith(JOHN_LABELED)
      })

      reader.update({ versionId: otherId })
      await screen.findByText('Al principio')
      pressVerse('Al principio')

      expect(onVerseSelect).toHaveBeenLastCalledWith(OTHER_UNLABELED)

      releaseOther()
      await waitFor(() => {
        expect(onVerseSelect).toHaveBeenLastCalledWith(OTHER_LABELED)
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

  it('does not land a focus after a same-chapter request drops it', async () => {
    const onVerseFocusApplied = jest.fn()
    const reader = mount()

    await screen.findByText('In the beginning')
    reader.update({ verseFocus: FOCUS, onVerseFocusApplied })
    reader.update({
      verseFocus: { ...FOCUS, shouldFocus: false, scrollsToVerse: false },
    })

    await new Promise((resolve) => {
      setTimeout(resolve, 700)
    })

    expect(onVerseFocusApplied).not.toHaveBeenCalled()
  })

  it('scrolls a tall paragraph to the requested verse line', async () => {
    const html =
      '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>' +
      'In the beginning <span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>He was with God</div></div>'
    const fetchBibleContent: FetchBibleContent = async () => ({
      status: 200,
      body: JSON.stringify({ content: html, reference: 'John 1' }),
      contentType: 'application/json',
    })
    const block = parsePassage(html).blocks[0]
    const verseText = (verse: number): string => {
      const inline = block?.segments
        .find((segment) => segment.verse === verse)
        ?.inlines.find((item) => item.kind === 'text')
      if (inline?.kind !== 'text') {
        throw new Error(`missing verse ${verse}`)
      }
      return inline.text
    }
    const scrollTo = jest.fn()
    const scrollSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(scrollTo)
    const reader = mount({ fetchBibleContent })

    await screen.findByText('He was with God')
    reader.update({ verseFocus: { ...FOCUS, passageId: 'JHN.1.2' } })

    const paragraph = screen.UNSAFE_getAllByType(Text).find((node) => node.props.onTextLayout)
    if (paragraph === undefined) {
      throw new Error('missing paragraph layout')
    }
    const ancestors: ReactTestInstance[] = []
    let parent = paragraph.parent
    while (parent !== null && ancestors.length < 2) {
      if (parent.props.onLayout !== undefined) {
        ancestors.push(parent)
      }
      parent = parent.parent
    }
    const blockView = ancestors[0]
    const passage = ancestors[1]
    if (blockView === undefined || passage === undefined) {
      throw new Error('missing block layout')
    }
    const lineY = 480
    const lineHeight = 32
    const viewport = 200
    const passageTop = 16
    fireEvent(paragraph, 'textLayout', {
      nativeEvent: {
        lines: [
          { text: verseText(1), y: 0, height: lineHeight },
          { text: verseText(2), y: lineY, height: lineHeight },
        ],
      },
    })
    fireEvent(blockView, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 800 } },
    })
    fireEvent(passage, 'layout', {
      nativeEvent: { layout: { x: 0, y: passageTop, width: 300, height: 800 } },
    })
    fireEvent(screen.UNSAFE_getByType(ScrollView), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 300, height: viewport } },
    })

    try {
      await waitFor(() => {
        expect(scrollTo).toHaveBeenLastCalledWith({
          y: passageTop + lineY + lineHeight / 2 - viewport / 2,
          animated: true,
        })
      })
    } finally {
      scrollSpy.mockRestore()
    }
  })

  it('clears the dim when a later focus targets a verse the text omits', async () => {
    const twoVerses: FetchBibleContent = async () => ({
      status: 200,
      body: JSON.stringify({
        content:
          '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>' +
          'In the beginning</div><div class="p"><span class="yv-v" v="2"></span>' +
          '<span class="yv-vlbl">2</span>He was with God</div></div>',
        reference: 'John 1',
      }),
      contentType: 'application/json',
    })
    const onVerseFocusApplied = jest.fn()
    const reader = mount({ fetchBibleContent: twoVerses, onVerseFocusApplied })
    // Ink sits on the paragraph's Text, above the run that holds the words.
    const colorOf = (text: string): ColorValue | undefined => {
      let node: ReactTestInstance | null = screen.getByText(text)
      while (node !== null) {
        const style: TextStyle | undefined = StyleSheet.flatten(node.props.style)
        const color = style?.color
        if (color !== undefined) {
          return color
        }
        node = node.parent
      }
      return undefined
    }

    await screen.findByText('He was with God')
    const bright = colorOf('He was with God')
    expect(bright).toBeDefined()
    reader.update({ verseFocus: FOCUS })
    await waitFor(() => {
      expect(colorOf('He was with God')).not.toEqual(bright)
    })

    reader.update({ verseFocus: { ...FOCUS, seq: 2, passageId: 'JHN.1.9' } })
    await waitFor(() => {
      expect(onVerseFocusApplied).toHaveBeenCalledWith({ stream: 0, seq: 2 })
    })
    expect(colorOf('He was with God')).toEqual(bright)
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

  it('hides an excluded version and does not load its chapter', async () => {
    const fetchBibleContent = jest.fn(
      fetchChapters({ '1': { status: 200, sentence: 'In the beginning' } }),
    )
    mount({ fetchBibleContent, excludedVersionIds: [VERSION_ID] })

    await screen.findByText(UNAVAILABLE)
    expect(screen.queryByText('In the beginning')).toBeNull()
    expect(screen.queryByText('Retry')).toBeNull()
    expect(passageRequested(fetchBibleContent)).toBe(false)
  })

  it('hides scripture when the permit list is empty', async () => {
    const fetchBibleContent = jest.fn(
      fetchChapters({ '1': { status: 200, sentence: 'In the beginning' } }),
    )
    mount({ fetchBibleContent, permittedVersionIds: [] })

    await screen.findByText(UNAVAILABLE)
    expect(screen.queryByText('In the beginning')).toBeNull()
    expect(screen.queryByText('Retry')).toBeNull()
    expect(passageRequested(fetchBibleContent)).toBe(false)
  })

  it('hides scripture when the version language is outside the provider list', async () => {
    const restore = stubVersionNames({ [VERSION_ID]: 'RVR' }, { [VERSION_ID]: 'es' })
    const fetchBibleContent = jest.fn(
      fetchChapters({ '1': { status: 200, sentence: 'In the beginning' } }),
    )
    try {
      mount({ fetchBibleContent, permittedLanguageTags: ['en'] })

      await screen.findByText(UNAVAILABLE)
      expect(screen.queryByText('In the beginning')).toBeNull()
      expect(screen.queryByText('Retry')).toBeNull()
      expect(passageRequested(fetchBibleContent)).toBe(false)
    } finally {
      restore()
    }
  })

  it('hides scripture when a language list is set and the version has no language tag', async () => {
    const prior = global.fetch
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = fetchUrl(input)
      if (/\/v1\/bibles\/\d+(?:\?|$)/.test(url) && !url.includes('/books')) {
        return metadataResponse(JSON.stringify({ abbreviation: 'BSB' }))
      }
      return prior(input, init)
    })
    const fetchBibleContent = jest.fn(
      fetchChapters({ '1': { status: 200, sentence: 'In the beginning' } }),
    )
    try {
      mount({ fetchBibleContent, permittedLanguageTags: ['en'] })

      await screen.findByText(UNAVAILABLE)
      expect(screen.queryByText('In the beginning')).toBeNull()
      expect(screen.queryByText('Retry')).toBeNull()
      expect(passageRequested(fetchBibleContent)).toBe(false)
    } finally {
      global.fetch = prior
    }
  })

  it('offers retry when a language lookup fails, then shows an allowed chapter', async () => {
    let failLookup = true
    const prior = global.fetch
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = fetchUrl(input)
      if (/\/v1\/bibles\/\d+(?:\?|$)/.test(url) && !url.includes('/books')) {
        if (failLookup) {
          return Promise.reject(new Error('offline'))
        }
        return metadataResponse(JSON.stringify({ abbreviation: 'BSB', language_tag: 'en' }))
      }
      return prior(input, init)
    })
    const fetchBibleContent = jest.fn(
      fetchChapters({ '1': { status: 200, sentence: 'In the beginning' } }),
    )
    try {
      mount({ fetchBibleContent, permittedLanguageTags: ['en'] })

      await screen.findByText(OFFLINE)
      expect(screen.queryByText(UNAVAILABLE)).toBeNull()
      expect(screen.queryByText('In the beginning')).toBeNull()
      expect(passageRequested(fetchBibleContent)).toBe(false)

      failLookup = false
      fireEvent.press(screen.getByText('Retry'))

      await screen.findByText('In the beginning')
      expect(screen.queryByText(OFFLINE)).toBeNull()
    } finally {
      global.fetch = prior
    }
  })

  it('shows scripture when the version language is on the provider list', async () => {
    const restore = stubVersionNames({ [VERSION_ID]: 'BSB' }, { [VERSION_ID]: 'en' })
    try {
      mount({ permittedLanguageTags: ['en'] })
      await screen.findByText('In the beginning')
    } finally {
      restore()
    }
  })

  it('hides a loaded chapter and clears its selection when the version becomes excluded', async () => {
    const onVerseSelect = jest.fn()
    const reader = mount({ onVerseSelect })

    await screen.findByText('In the beginning')
    pressVerse('In the beginning')
    expect(onVerseSelect).toHaveBeenCalledWith(JOHN_1)

    reader.update({ excludedVersionIds: [VERSION_ID] })

    await screen.findByText(UNAVAILABLE)
    expect(screen.queryByText('In the beginning')).toBeNull()
    expect(screen.queryByText('Retry')).toBeNull()
    expect(onVerseSelect).toHaveBeenLastCalledWith(CLEARED_CHAPTER)
  })
})

function passageRequested(fetchBibleContent: jest.MockedFunction<FetchBibleContent>): boolean {
  return fetchBibleContent.mock.calls.some(([request]) => request.path.includes('/passages/'))
}
