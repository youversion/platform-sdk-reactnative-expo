import { act, renderHook, waitFor } from '@testing-library/react-native'
import type {
  BibleContentResponse,
  FetchBibleContent,
} from '@youversion/platform-react-native-expo-core'

import {
  chapterRef,
  footnoteFor,
  passageRefFor,
  usePassage,
  type LoadedPassage,
} from '../use-passage'

const VALID_BODY = JSON.stringify({
  content:
    '<div><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>In the beginning</div></div>',
  reference: 'Genesis 1',
})

function respond(status: number, body = ''): FetchBibleContent {
  return jest.fn(
    async (): Promise<BibleContentResponse> => ({ status, body, contentType: 'application/json' }),
  )
}

function renderPassage(fetchBibleContent: FetchBibleContent) {
  return renderHook(() => usePassage(fetchBibleContent, 111, chapterRef('GEN', '1')))
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

async function settled(fetchBibleContent: FetchBibleContent) {
  const hook = renderPassage(fetchBibleContent)
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('usePassage', () => {
  it('sets the passage and no error on a 200 with a valid body', async () => {
    const { result } = await settled(respond(200, VALID_BODY))
    expect(result.current.error).toBeNull()
    expect(result.current.passage).toMatchObject({ key: '111:GEN.1', reference: 'Genesis 1' })
  })

  it.each([403, 404])('reports %i as unavailable', async (status) => {
    const { result } = await settled(respond(status))
    expect(result.current.error).toBe('unavailable')
    expect(result.current.passage).toBeNull()
  })

  it.each([401, 429, 503])('reports %i as failed, not unavailable', async (status) => {
    const { result } = await settled(respond(status))
    expect(result.current.error).toBe('failed')
  })

  it.each([
    ['invalid JSON', '<html>'],
    ['a body missing content', JSON.stringify({ reference: 'Genesis 1' })],
  ])('reports a 200 with %s as failed', async (_label, body) => {
    const { result } = await settled(respond(200, body))
    expect(result.current.error).toBe('failed')
  })

  it('reports a rejected fetch as offline', async () => {
    const fetchBibleContent: FetchBibleContent = jest.fn(async () => {
      throw new TypeError('Network request failed')
    })
    const { result } = await settled(fetchBibleContent)
    expect(result.current.error).toBe('offline')
  })

  it('refetches on retry() and clears the error once it loads', async () => {
    const fetchBibleContent = jest
      .fn<Promise<BibleContentResponse>, Parameters<FetchBibleContent>>()
      .mockResolvedValueOnce({ status: 503, body: '', contentType: null })
      .mockResolvedValueOnce({ status: 200, body: VALID_BODY, contentType: 'application/json' })
    const { result } = await settled(fetchBibleContent)
    expect(result.current.error).toBe('failed')

    act(() => result.current.retry())

    await waitFor(() => expect(result.current.passage).not.toBeNull())
    expect(fetchBibleContent).toHaveBeenCalledTimes(2)
    expect(result.current.error).toBeNull()
  })

  it('drops a response that resolves after the chapter changed', async () => {
    const first = deferred<BibleContentResponse>()
    const fetchBibleContent = jest
      .fn<Promise<BibleContentResponse>, Parameters<FetchBibleContent>>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ status: 200, body: VALID_BODY, contentType: 'application/json' })
    const { result, rerender } = renderHook(
      ({ chapter }: { chapter: string }) =>
        usePassage(fetchBibleContent, 111, chapterRef('GEN', chapter)),
      { initialProps: { chapter: '1' } },
    )

    rerender({ chapter: '2' })
    await waitFor(() => expect(result.current.passage?.key).toBe('111:GEN.2'))

    await act(async () => {
      first.resolve({ status: 503, body: '', contentType: null })
      await first.promise
    })
    expect(result.current.passage?.key).toBe('111:GEN.2')
    expect(result.current.error).toBeNull()
  })

  it('requests a verse range as its own passage and scopes it to the chapter', async () => {
    const fetchBibleContent = respond(200, VALID_BODY)
    const address = passageRefFor('JHN.3.16-18')
    const { result } = renderHook(() => usePassage(fetchBibleContent, 111, address))

    await waitFor(() => expect(result.current.passage).not.toBeNull())
    expect(fetchBibleContent).toHaveBeenCalledWith({
      path: '/v1/bibles/111/passages/JHN.3.16-18?format=html&include_headings=true&include_notes=true',
    })
    expect(result.current.passage).toMatchObject({
      key: '111:JHN.3.16-18',
      usfm: 'JHN.3.16-18',
      book: 'JHN',
      chapter: '3',
    })
  })

  it('sends nothing without an address', () => {
    const fetchBibleContent = respond(200, VALID_BODY)
    const { result } = renderHook(() => usePassage(fetchBibleContent, 111, null))

    expect(fetchBibleContent).not.toHaveBeenCalled()
    expect(result.current).toMatchObject({ passage: null, loading: false, error: null })
  })

  it('clears the error when the address becomes null after a failed fetch', async () => {
    const fetchBibleContent = respond(503)
    const { result, rerender } = renderHook(
      ({ address }: { address: ReturnType<typeof chapterRef> | null }) =>
        usePassage(fetchBibleContent, 111, address),
      { initialProps: { address: chapterRef('GEN', '1') } },
    )

    await waitFor(() => expect(result.current.error).toBe('failed'))

    rerender({ address: null })

    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('parses supplied HTML and does not fetch', async () => {
    const fetchBibleContent = respond(200, VALID_BODY)
    const html =
      '<div><div class="p"><span class="yv-v" v="16"></span><span class="yv-vlbl">16</span>For God</div></div>'
    const { result } = renderHook(() =>
      usePassage(fetchBibleContent, 111, passageRefFor('JHN.3.16'), {
        content: html,
        reference: 'John 3:16',
      }),
    )

    expect(result.current.passage).toMatchObject({
      key: '111:JHN.3.16',
      reference: 'John 3:16',
      book: 'JHN',
      chapter: '3',
    })
    expect(result.current.passage?.parsed.blocks.length).toBeGreaterThan(0)
    expect(result.current).toMatchObject({ loading: false, error: null })

    await act(async () => {
      await Promise.resolve()
    })
    expect(fetchBibleContent).not.toHaveBeenCalled()
  })
})

describe('passageRefFor', () => {
  it.each([
    ['JHN.3', 'JHN', '3'],
    ['JHN.3.16', 'JHN', '3'],
    ['JHN.3.16-18', 'JHN', '3'],
    ['GEN.INTRO', 'GEN', 'INTRO'],
    ['JHN.INTRO', 'JHN', 'INTRO'],
  ])('keeps %s whole and scopes it to %s %s', (usfm, book, chapter) => {
    expect(passageRefFor(usfm)).toEqual({ usfm, book, chapter })
  })

  it.each([
    '',
    'JHN',
    'JHN.0',
    'JHN..1',
    'JHN.3.16.18',
    'ROM.8.38-9.1',
    'ROM.8.38-ROM.9.1',
    'JHN.3.16,18',
    'JHN.3.16,JHN.3.18-20',
    'PSA.119.1-300',
  ])('refuses %j', (usfm) => {
    expect(passageRefFor(usfm)).toBeNull()
  })
})

describe('footnoteFor', () => {
  function passage(reference: string): LoadedPassage {
    return {
      usfm: 'JHN.3.16',
      book: 'JHN',
      chapter: '3',
      key: '111:JHN.3.16',
      versionId: 111,
      reference,
      parsed: { blocks: [], verses: new Map(), rtl: false },
    }
  }

  it.each([
    ['John 3:16', '16', 'John 3:16'],
    ['John 3:16-18', '17', 'John 3:17'],
    ['John 3', '16', 'John 3:16'],
  ])(
    'gives FootnoteContent a chapter reference so %j + verse %s heads as %j',
    (reference, verse, heading) => {
      const data = footnoteFor(passage(reference), Number(verse), '<span>note</span>')
      expect(`${data.reference}:${data.verseNum}`).toBe(heading)
    },
  )

  it('drops API bidi marks from the chapter reference', () => {
    const data = footnoteFor(passage('يوحنا ‏١:١'), 1, '<span>note</span>')
    expect(data.reference).toBe('يوحنا ١')
    expect(data.reference).not.toMatch(/[‎‏]/)
  })
})
