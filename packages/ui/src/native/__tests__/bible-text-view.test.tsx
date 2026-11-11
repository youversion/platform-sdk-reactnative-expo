import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { UseHighlightsOptions } from '@youversion/platform-react-native-expo-core'
import type { FootnoteData } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import { highlightEndRoom } from '../scripture/passage'
import { INTER_FONT } from '../../lib/reader-fonts'
import { READER_LINE_SPACING } from '../../stores/types/reader-line-spacing'
import { getTokens } from '../../theme'
import { defaultHookOverrides, emptyHighlights } from '../../test-utils/default-hook-overrides'
import { resetImpls, setImpl } from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { YouVersionProvider } from '../youversion-provider'
import { BibleTextView } from '../bible-text-view'
import { lineMultiple } from '../scripture/styles'

const UNAVAILABLE = 'This passage is unavailable in the selected Bible version.'
const OFFLINE = 'We\u2019re having difficulties with your connection.'
const JOHN = 'For God so loved the world'
const GAVE = 'that he gave'

const useHighlightsMock = jest.fn(emptyHighlights)

function verseBlock(verse: number, text: string): string {
  return `<span class="yv-v" v="${verse}"></span><span class="yv-vlbl">${verse}</span>${text}`
}

function passageHtml(body: string): string {
  return `<div><div class="p">${body}</div></div>`
}

function jsonPassage(html: string, reference: string, status = 200): Response {
  return new Response(JSON.stringify({ content: html, reference }), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

function notFound(): Response {
  return new Response('', { status: 404, headers: { 'cache-control': 'no-store' } })
}

function installFetch(onPassage: (usfm: string) => Response | Promise<Response>): void {
  const prior = global.fetch
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    const match = /\/passages\/([^?]+)/.exec(url)
    if (match?.[1] === undefined) {
      return prior(input, init)
    }
    return Promise.resolve(onPassage(decodeURIComponent(match[1])))
  })
}

function serveOnly(usfm: string, html: string, reference: string): void {
  installFetch((requested) => (requested === usfm ? jsonPassage(html, reference) : notFound()))
}

function passageRequests(): string[] {
  return jest
    .mocked(global.fetch)
    .mock.calls.map(([input]) => (input instanceof Request ? input.url : String(input)))
    .filter((url) => url.includes('/passages/'))
}

function highlightWrapper(theme: 'light' | 'dark' = 'light') {
  return youVersionProviderWrapper(theme, undefined, { useHighlights: useHighlightsMock })
}

function filteredWrapper(filters: {
  excludedVersionIds?: number[]
  permittedVersionIds?: number[]
  permittedLanguageTags?: string[]
}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <YouVersionProvider
        appKey="test-key"
        theme="light"
        hookOverrides={{ ...defaultHookOverrides, useHighlights: useHighlightsMock }}
        {...filters}
      >
        {children}
      </YouVersionProvider>
    )
  }
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

function metadataResponse(body: string): Promise<Response> {
  return Promise.resolve(
    new Response(body, {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    }),
  )
}

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
        return metadataResponse(
          JSON.stringify({
            abbreviation,
            language_tag: languageTags[Number(match[1])] ?? 'en',
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

function passageChromeWrapper(text: string): ReactTestInstance {
  const nodes = screen.getAllByText(text)
  for (const node of nodes) {
    let current: ReactTestInstance | null = node
    while (current !== null) {
      const style = StyleSheet.flatten(current.props.style)
      if (
        style !== undefined &&
        (style.paddingHorizontal !== undefined || style.marginHorizontal !== undefined)
      ) {
        return current
      }
      current = current.parent
    }
  }
  throw new Error(`missing passage chrome wrapper for ${text}`)
}

function styleValue(text: string, key: keyof TextStyle): TextStyle[keyof TextStyle] {
  const nodes = screen.getAllByText(text)
  for (const node of nodes) {
    let current: ReactTestInstance | null = node
    while (current !== null) {
      const value = StyleSheet.flatten(current.props.style)?.[key]
      if (value !== undefined) {
        return value
      }
      current = current.parent
    }
  }
  throw new Error(`missing ${key} for ${text}`)
}

function paintHighlight(sentence: string): void {
  const paragraph = screen.UNSAFE_getAllByType(Text).find((node) => node.props.onTextLayout)
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
  let parent = paragraph.parent
  while (parent !== null) {
    if (parent.props.onLayout !== undefined) {
      fireEvent(parent, 'layout', {
        nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 40 } },
      })
      return
    }
    parent = parent.parent
  }
  throw new Error('missing block layout')
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

describe('BibleTextView', () => {
  const originalOs = Platform.OS
  let priorFetch: typeof fetch

  beforeEach(() => {
    priorFetch = global.fetch
    useHighlightsMock.mockReset()
    useHighlightsMock.mockImplementation(emptyHighlights)
    installFetch(() => notFound())
    setImpl('FootnoteContent', ({ data, fontSize }: { data: FootnoteData; fontSize?: number }) => (
      <>
        <Text testID="footnote-verse">{data.verseNum}</Text>
        <Text testID="footnote-font-size">{String(fontSize)}</Text>
      </>
    ))
    setImpl('NativeSheet', ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
      isOpen ? <View testID="footnote-sheet">{children}</View> : null,
    )
  })

  afterEach(() => {
    global.fetch = priorFetch
    resetImpls()
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      enumerable: true,
      value: originalOs,
    })
  })

  it('shows the words of JHN.3.16 when the fetch serves only that verse', async () => {
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText(JOHN)).toBeTruthy()
    expect(passageRequests().some((url) => url.includes('/passages/JHN.3.16?'))).toBe(true)
    expect(passageRequests().some((url) => url.includes('/passages/JHN.3?'))).toBe(false)
  })

  it('still paints native text when a deprecated dom prop is passed', async () => {
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    render(<BibleTextView reference="JHN.3.16" versionId={3034} dom={{ matchContents: true }} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText(JOHN)).toBeTruthy()
  })

  it('shows a verse range as its own passage', async () => {
    serveOnly(
      'JHN.3.16-18',
      passageHtml(`${verseBlock(16, `${JOHN} `)}${verseBlock(17, GAVE)}`),
      'John 3:16-18',
    )
    render(<BibleTextView reference="JHN.3.16-18" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText(JOHN, { exact: false })).toBeTruthy()
    expect(screen.getByText(GAVE)).toBeTruthy()
    expect(passageRequests().some((url) => url.includes('/passages/JHN.3.16-18?'))).toBe(true)
    expect(passageRequests().some((url) => /\/passages\/JHN\.3\?/.test(url))).toBe(false)
  })

  it('shows the verse number by default and hides it when asked', async () => {
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    const view = render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText('16')).toBeTruthy()
    view.rerender(<BibleTextView reference="JHN.3.16" versionId={3034} showVerseNumbers={false} />)
    await waitFor(() => expect(screen.queryByText('16')).toBeNull())
    expect(screen.getByText(JOHN)).toBeTruthy()
  })

  it('hides footnote markers when renderNotes is false', async () => {
    const note = '<span class="yv-n f"><span class="ft">Or the world</span></span>'
    serveOnly(
      'JHN.3.16',
      passageHtml(verseBlock(16, `For God${note} so loved the world`)),
      'John 3:16',
    )
    render(<BibleTextView reference="JHN.3.16" versionId={3034} renderNotes={false} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText('For God')).toBeTruthy()
    expect(screen.getByText('so loved the world', { exact: false })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Footnote' })).toBeNull()
  })

  it('opens the footnote sheet with the verse number', async () => {
    const note = '<span class="yv-n f"><span class="ft">Or the world</span></span>'
    serveOnly(
      'JHN.3.16',
      passageHtml(verseBlock(16, `For God${note} so loved the world`)),
      'John 3:16',
    )
    render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    fireEvent.press(await screen.findByRole('button', { name: 'Footnote' }))
    expect(screen.getByTestId('footnote-sheet')).toBeTruthy()
    expect(screen.getByTestId('footnote-verse').props.children).toBe('16')
  })

  it('gives a consumer the footnote and does not mount the sheet', async () => {
    const note = '<span class="yv-n f"><span class="ft">Or the world</span></span>'
    serveOnly(
      'JHN.3.16',
      passageHtml(verseBlock(16, `For God${note} so loved the world`)),
      'John 3:16',
    )
    const onFootnotePress = jest.fn(async () => undefined)
    render(
      <BibleTextView reference="JHN.3.16" versionId={3034} onFootnotePress={onFootnotePress} />,
      {
        wrapper: youVersionProviderWrapper(),
      },
    )

    fireEvent.press(await screen.findByRole('button', { name: 'Footnote' }))
    expect(onFootnotePress).toHaveBeenCalledWith(
      expect.objectContaining({ verseNum: '16', reference: 'John 3' }),
    )
    expect(screen.queryByTestId('footnote-sheet')).toBeNull()
  })

  it('does not draw footnote markers on web when the host passed no handler', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, enumerable: true, value: 'web' })
    const note = '<span class="yv-n f"><span class="ft">Or the world</span></span>'
    serveOnly(
      'JHN.3.16',
      passageHtml(verseBlock(16, `For God${note} so loved the world`)),
      'John 3:16',
    )
    render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText('For God')).toBeTruthy()
    expect(screen.getByText('so loved the world', { exact: false })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Footnote' })).toBeNull()
    expect(screen.queryByTestId('footnote-sheet')).toBeNull()
  })

  it('pads highlight end-room inside the host box with a matching background', async () => {
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText(JOHN)).toBeTruthy()
    const chrome = passageChromeWrapper(JOHN)
    const style = StyleSheet.flatten(chrome.props.style)
    expect(style?.marginHorizontal).toBeUndefined()
    expect(style?.paddingHorizontal).toBe(highlightEndRoom(16))
    expect(style?.backgroundColor).toBe(getTokens('light').background)
  })

  it('paints a cached highlight on the verse', async () => {
    useHighlightsMock.mockImplementation((options: UseHighlightsOptions) => ({
      ...emptyHighlights(options),
      highlights:
        options.enabled === false
          ? []
          : [{ version_id: 3034, passage_id: 'JHN.3.16', color: 'fffe00' }],
    }))
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    render(<BibleTextView reference="JHN.3.16" versionId={3034} />, { wrapper: highlightWrapper() })

    await screen.findByText(JOHN)
    paintHighlight(JOHN)
    await waitFor(() => {
      const painted = screen.UNSAFE_getAllByType(Text).some((node) => {
        return StyleSheet.flatten(node.props.style)?.backgroundColor === '#fffe00'
      })
      expect(painted).toBe(true)
    })
  })

  it('draws dark ink when theme is dark inside a light provider', async () => {
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    render(<BibleTextView reference="JHN.3.16" versionId={3034} theme="dark" />, {
      wrapper: youVersionProviderWrapper('light'),
    })

    expect(await screen.findByText(JOHN)).toBeTruthy()
    expect(styleValue(JOHN, 'color')).toBe(getTokens('dark').foreground)
  })

  it('draws Inter for the sans stack and the serif face by default', async () => {
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    const view = render(
      <BibleTextView reference="JHN.3.16" versionId={3034} fontFamily={INTER_FONT} />,
      {
        wrapper: youVersionProviderWrapper(),
      },
    )

    expect(await screen.findByText(JOHN)).toBeTruthy()
    expect(styleValue(JOHN, 'fontFamily')).toBe('Inter')

    view.rerender(<BibleTextView reference="JHN.3.16" versionId={3034} />)
    await waitFor(() => expect(styleValue(JOHN, 'fontFamily')).toBe('Untitled Serif'))
  })

  it('keeps a single host fontFamily name instead of replacing it with serif', async () => {
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    render(<BibleTextView reference="JHN.3.16" versionId={3034} fontFamily="sans-serif" />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText(JOHN)).toBeTruthy()
    expect(styleValue(JOHN, 'fontFamily')).toBe('sans-serif')
  })

  it('draws the SDK serif for a CSS fontFamily stack', async () => {
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    render(
      <BibleTextView reference="JHN.3.16" versionId={3034} fontFamily={'"Georgia", serif'} />,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(await screen.findByText(JOHN)).toBeTruthy()
    expect(styleValue(JOHN, 'fontFamily')).toBe('Untitled Serif')
  })

  it('draws a qs run in italic', async () => {
    serveOnly(
      'JHN.3.16',
      passageHtml(verseBlock(16, 'For God <span class="qs">Selah</span>')),
      'John 3:16',
    )
    render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText('Selah')).toBeTruthy()
    expect(styleValue('Selah', 'fontFamily')).toBe('Untitled Serif_italic')
  })

  it('reports the tapped verse, and clears it when that verse is already selected', async () => {
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    const onVerseSelect = jest.fn(async () => undefined)
    const view = render(
      <BibleTextView reference="JHN.3.16" versionId={3034} onVerseSelect={onVerseSelect} />,
      { wrapper: youVersionProviderWrapper() },
    )

    await screen.findByText(JOHN)
    pressVerse(JOHN)
    expect(onVerseSelect).toHaveBeenCalledWith([16])

    view.rerender(
      <BibleTextView
        reference="JHN.3.16"
        versionId={3034}
        onVerseSelect={onVerseSelect}
        selectedVerses={[16]}
      />,
    )
    pressVerse(JOHN)
    expect(onVerseSelect).toHaveBeenLastCalledWith([])
  })

  it('shows an excluded version as unavailable and does not request the passage', async () => {
    render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
      wrapper: filteredWrapper({ excludedVersionIds: [3034] }),
    })

    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy()
    expect(passageRequests()).toEqual([])
  })

  it('hides scripture when the permit list is empty', async () => {
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
      wrapper: filteredWrapper({ permittedVersionIds: [] }),
    })

    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy()
    expect(screen.queryByText(JOHN)).toBeNull()
    expect(screen.queryByText('Retry')).toBeNull()
    expect(passageRequests()).toEqual([])
  })

  it('hides scripture when the version language is outside the provider list', async () => {
    const restore = stubVersionNames({ 3034: 'RVR' }, { 3034: 'es' })
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    try {
      render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
        wrapper: filteredWrapper({ permittedLanguageTags: ['en'] }),
      })

      expect(await screen.findByText(UNAVAILABLE)).toBeTruthy()
      expect(screen.queryByText(JOHN)).toBeNull()
      expect(screen.queryByText('Retry')).toBeNull()
      expect(passageRequests()).toEqual([])
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
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    try {
      render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
        wrapper: filteredWrapper({ permittedLanguageTags: ['en'] }),
      })

      expect(await screen.findByText(UNAVAILABLE)).toBeTruthy()
      expect(screen.queryByText(JOHN)).toBeNull()
      expect(screen.queryByText('Retry')).toBeNull()
      expect(passageRequests()).toEqual([])
    } finally {
      global.fetch = prior
    }
  })

  it('offers retry when a language lookup fails, then shows an allowed passage', async () => {
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
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    try {
      render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
        wrapper: filteredWrapper({ permittedLanguageTags: ['en'] }),
      })

      expect(await screen.findByText(OFFLINE)).toBeTruthy()
      expect(screen.queryByText(UNAVAILABLE)).toBeNull()
      expect(screen.queryByText(JOHN)).toBeNull()
      expect(passageRequests()).toEqual([])

      failLookup = false
      fireEvent.press(screen.getByText('Retry'))

      expect(await screen.findByText(JOHN)).toBeTruthy()
      expect(screen.queryByText(OFFLINE)).toBeNull()
    } finally {
      global.fetch = prior
    }
  })

  it('shows scripture when the version language is on the provider list', async () => {
    const restore = stubVersionNames({ 3034: 'BSB' }, { 3034: 'en' })
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    try {
      render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
        wrapper: filteredWrapper({ permittedLanguageTags: ['en'] }),
      })
      expect(await screen.findByText(JOHN)).toBeTruthy()
    } finally {
      restore()
    }
  })

  it('shows a spinner while language lookup is in flight and does not fetch the passage', async () => {
    const prior = global.fetch
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = fetchUrl(input)
      if (/\/v1\/bibles\/3034(?:\?|$)/.test(url) && !url.includes('/books')) {
        return new Promise(() => {})
      }
      return prior(input, init)
    })
    try {
      render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
        wrapper: filteredWrapper({ permittedLanguageTags: ['en'] }),
      })

      expect(await screen.findByLabelText('Loading')).toBeTruthy()
      expect(passageRequests()).toEqual([])
    } finally {
      global.fetch = prior
    }
  })

  it('shows an unreadable reference as unavailable and does not request a passage', async () => {
    render(<BibleTextView reference="not-usfm" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy()
    expect(passageRequests()).toEqual([])
  })

  it('requests a catalog introduction chapter', async () => {
    serveOnly('GEN.INTRO', passageHtml('<p>Introduction</p>'), 'Genesis Introduction')
    render(<BibleTextView reference="GEN.INTRO" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText('Introduction')).toBeTruthy()
    expect(passageRequests().some((url) => url.includes('/passages/GEN.INTRO'))).toBe(true)
  })

  it('shows the connection message and loads the passage on retry', async () => {
    let hits = 0
    installFetch((requested) => {
      if (requested !== 'JHN.3.16') {
        return notFound()
      }
      hits += 1
      if (hits === 1) {
        return Promise.reject(new TypeError('Network request failed'))
      }
      return jsonPassage(passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    })
    render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText(OFFLINE)).toBeTruthy()
    fireEvent.press(screen.getByText('Retry'))
    expect(await screen.findByText(JOHN)).toBeTruthy()
  })

  it('draws lineHeight 2 as twice the font size, not the large reader step', async () => {
    serveOnly('JHN.3.16', passageHtml(verseBlock(16, JOHN)), 'John 3:16')
    render(<BibleTextView reference="JHN.3.16" versionId={3034} lineHeight={2} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText(JOHN)).toBeTruthy()
    const drawn = styleValue(JOHN, 'lineHeight')
    expect(drawn).toBe(32)
    expect(drawn).not.toBe(16 * lineMultiple(READER_LINE_SPACING.LG))
  })

  it('uses font size 16 for verse and footnote when fontSize is omitted', async () => {
    const note = '<span class="yv-n f"><span class="ft">Or the world</span></span>'
    serveOnly(
      'JHN.3.16',
      passageHtml(verseBlock(16, `For God${note} so loved the world`)),
      'John 3:16',
    )
    render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText('For God')).toBeTruthy()
    expect(styleValue('For God', 'fontSize')).toBe(16)
    fireEvent.press(await screen.findByRole('button', { name: 'Footnote' }))
    expect(screen.getByTestId('footnote-font-size').props.children).toBe('16')
  })

  it('renders supplied HTML and does not fetch', async () => {
    render(
      <BibleTextView
        reference="JHN.3.16"
        versionId={3034}
        passageState={{
          passage: {
            id: 'JHN.3.16',
            content: passageHtml(verseBlock(16, JOHN)),
            reference: 'John 3:16',
          },
          loading: false,
          error: null,
        }}
      />,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(await screen.findByText(JOHN)).toBeTruthy()
    expect(passageRequests()).toEqual([])
  })

  it('shows unavailable for an idle empty supplied state instead of spinning forever', async () => {
    render(
      <BibleTextView
        reference="JHN.3.16"
        versionId={3034}
        passageState={{ passage: null, loading: false, error: null }}
      />,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy()
    expect(screen.queryByLabelText('Loading')).toBeNull()
    expect(passageRequests()).toEqual([])
  })

  it('shows a spinner for a supplied loading state with no passage', async () => {
    render(
      <BibleTextView
        reference="JHN.3.16"
        versionId={3034}
        passageState={{ passage: null, loading: true, error: null }}
      />,
      { wrapper: youVersionProviderWrapper() },
    )

    expect(await screen.findByLabelText('Loading')).toBeTruthy()
    expect(screen.queryByText(UNAVAILABLE)).toBeNull()
    expect(passageRequests()).toEqual([])
  })

  it('drops a retained fetch error when the host switches to a supplied loading state', async () => {
    installFetch(() => Promise.reject(new TypeError('Network request failed')))
    const view = render(<BibleTextView reference="JHN.3.16" versionId={3034} />, {
      wrapper: youVersionProviderWrapper(),
    })

    expect(await screen.findByText(OFFLINE)).toBeTruthy()
    expect(screen.getByText('Retry')).toBeTruthy()

    view.rerender(
      <BibleTextView
        reference="JHN.3.16"
        versionId={3034}
        passageState={{ passage: null, loading: true, error: null }}
      />,
    )

    expect(await screen.findByLabelText('Loading')).toBeTruthy()
    expect(screen.queryByText(OFFLINE)).toBeNull()
    expect(screen.queryByText('Retry')).toBeNull()
  })

  it('throws when YouVersionProvider is missing', () => {
    expect(() => render(<BibleTextView reference="JHN.3.16" versionId={3034} />)).toThrow(
      'useYouVersion must be used inside of YouVersionProvider',
    )
  })

  describe('the highlights subscription scope', () => {
    it('subscribes at the chapter for a verse USFM', async () => {
      render(<BibleTextView reference="JHN.3.16" versionId={111} />, {
        wrapper: highlightWrapper(),
      })

      expect(await screen.findByText(UNAVAILABLE)).toBeTruthy()
      expect(useHighlightsMock).toHaveBeenCalledWith({
        versionId: 111,
        book: 'JHN',
        chapter: '3',
        enabled: true,
      })
    })

    it('subscribes at the chapter for a verse-range USFM', async () => {
      render(<BibleTextView reference="JHN.1.1-4" versionId={111} />, {
        wrapper: highlightWrapper(),
      })

      expect(await screen.findByText(UNAVAILABLE)).toBeTruthy()
      expect(useHighlightsMock).toHaveBeenCalledWith({
        versionId: 111,
        book: 'JHN',
        chapter: '1',
        enabled: true,
      })
    })

    it('subscribes at the chapter for a chapter USFM', async () => {
      render(<BibleTextView reference="JHN.1" versionId={111} />, { wrapper: highlightWrapper() })

      expect(await screen.findByText(UNAVAILABLE)).toBeTruthy()
      expect(useHighlightsMock).toHaveBeenCalledWith({
        versionId: 111,
        book: 'JHN',
        chapter: '1',
        enabled: true,
      })
    })

    it('disables the subscription when the USFM cannot be read', () => {
      render(<BibleTextView reference="not-usfm" versionId={111} />, {
        wrapper: highlightWrapper(),
      })

      expect(screen.getByText(UNAVAILABLE)).toBeTruthy()
      expect(useHighlightsMock).toHaveBeenCalledWith({
        versionId: 1,
        book: '_',
        chapter: '0',
        enabled: false,
      })
    })

    it('disables the subscription for a catalog introduction', async () => {
      serveOnly('GEN.INTRO', passageHtml('<p>Introduction</p>'), 'Genesis Introduction')
      render(<BibleTextView reference="GEN.INTRO" versionId={111} />, {
        wrapper: highlightWrapper(),
      })

      expect(await screen.findByText('Introduction')).toBeTruthy()
      expect(useHighlightsMock).toHaveBeenCalledWith({
        versionId: 1,
        book: '_',
        chapter: '0',
        enabled: false,
      })
    })
  })
})
