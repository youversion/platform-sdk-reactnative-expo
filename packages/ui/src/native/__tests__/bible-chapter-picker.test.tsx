import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { ScrollView } from 'react-native'
import type { ReactTestInstance } from 'react-test-renderer'

import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleChapterPicker } from '../bible-chapter-picker'
import { YouVersionProvider } from '../youversion-provider'

function booksResponse(): Response {
  return new Response(
    JSON.stringify({
      data: [
        {
          id: 'JHN',
          title: 'John',
          chapters: [
            { id: '1', title: '1' },
            { id: '2', title: '2' },
          ],
        },
        {
          id: 'GEN',
          title: 'Genesis',
          intro: { id: 'INTRO', title: 'Introduction' },
          chapters: [
            { id: 'INTRO', title: 'Introduction' },
            { id: '1', title: '1' },
          ],
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
  )
}

function fontResponse(): Response {
  return new Response(
    JSON.stringify({
      id: 1,
      slug: 'untitled-serif',
      family: 'Untitled Serif',
      variants: [
        {
          weight: 400,
          style: 'normal',
          sources: [{ format: 'ttf', url: 'https://cdn.youversion.com/test.ttf' }],
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

describe('BibleChapterPicker', () => {
  afterEach(() => jest.restoreAllMocks())

  it('renders API order, the selected book and chapter, intro, sorting, and fuzzy search', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation((input) =>
        String(input).includes('/v1/fonts/')
          ? Promise.resolve(fontResponse())
          : Promise.resolve(booksResponse()),
      )
    const { getByLabelText, getByText, queryByText } = render(
      <BibleChapterPicker book="jhn" chapter="2" versionId={9101} />,
      { wrapper: youVersionProviderWrapper() },
    )

    await waitFor(() => expect(getByText('John')).toBeTruthy())
    expect(getByLabelText('John 2').props.accessibilityState).toMatchObject({ selected: true })

    fireEvent.press(getByText('Genesis'))
    expect(getByLabelText('Genesis Introduction')).toBeTruthy()

    fireEvent.press(getByText('Alphabetical'))

    fireEvent.changeText(getByLabelText('Search'), 'Gensis')
    expect(getByText('Genesis')).toBeTruthy()
    expect(queryByText('John')).toBeNull()
  })

  it('blocks duplicate selections while pending and restores interaction after rejection', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation((input) =>
        String(input).includes('/v1/fonts/')
          ? Promise.resolve(fontResponse())
          : Promise.resolve(booksResponse()),
      )
    let rejectSelection: (reason: Error) => void = () => {}
    const onSelect = jest.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSelection = reject
        }),
    )
    const { getByLabelText, getByText } = render(
      <BibleChapterPicker book="JHN" chapter="1" versionId={9102} onSelect={onSelect} />,
      { wrapper: youVersionProviderWrapper() },
    )
    await waitFor(() => expect(getByText('John')).toBeTruthy())

    fireEvent.press(getByLabelText('John 2'))
    fireEvent.press(getByLabelText('John 1'))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(getByLabelText('John 2').props.accessibilityState).toMatchObject({ disabled: true })
    expect(getByText('2')).toBeTruthy()

    await act(async () => rejectSelection(new Error('not saved')))
    expect(getByLabelText('John 2').props.accessibilityState).toMatchObject({ disabled: false })
  })

  it('retries request failures and treats an empty book list as an error', async () => {
    let bookRequests = 0
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((input) => {
      if (String(input).includes('/v1/fonts/')) return Promise.resolve(fontResponse())
      bookRequests += 1
      if (bookRequests === 1) return Promise.resolve(new Response('{}', { status: 500 }))
      return Promise.resolve(
        new Response(JSON.stringify({ data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        }),
      )
    })
    const { getByText } = render(<BibleChapterPicker versionId={9103} />, {
      wrapper: youVersionProviderWrapper(),
    })

    await waitFor(() => expect(getByText('Error')).toBeTruthy())
    fireEvent.press(getByText('Retry'))

    await waitFor(() => expect(bookRequests).toBe(2))
    expect(getByText('Error')).toBeTruthy()
    expect(fetchSpy).toHaveBeenCalled()
  })

  it('does not load books for a version refused by provider id filters', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((input) => {
      if (String(input).includes('/v1/fonts/')) return Promise.resolve(fontResponse())
      return Promise.resolve(booksResponse())
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <YouVersionProvider appKey="test-key" permittedVersionIds={[111]}>
        {children}
      </YouVersionProvider>
    )

    const { getByText } = render(<BibleChapterPicker versionId={9104} />, { wrapper })

    await waitFor(() => expect(getByText('Error')).toBeTruthy())
    expect(
      fetchSpy.mock.calls.some(([input]) => String(input).includes('/v1/bibles/9104/books')),
    ).toBe(false)
  })

  it('checks a version language before loading its books', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/v1/fonts/')) return Promise.resolve(fontResponse())
      if (url.endsWith('/v1/bibles/9105')) {
        return Promise.resolve(
          new Response(JSON.stringify({ language_tag: 'es' }), {
            status: 200,
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
          }),
        )
      }
      return Promise.resolve(booksResponse())
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <YouVersionProvider appKey="test-key" permittedLanguageTags={['en']}>
        {children}
      </YouVersionProvider>
    )

    const { getByText } = render(<BibleChapterPicker versionId={9105} />, { wrapper })

    await waitFor(() => expect(getByText('Error')).toBeTruthy())
    expect(
      fetchSpy.mock.calls.some(([input]) => String(input).includes('/v1/bibles/9105/books')),
    ).toBe(false)
  })

  it('keeps the loaded catalog when the provider recreates the same language filter', async () => {
    let bookRequests = 0
    jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.includes('/v1/fonts/')) return Promise.resolve(fontResponse())
      if (url.endsWith('/v1/bibles/9106')) {
        return Promise.resolve(
          new Response(JSON.stringify({ language_tag: 'en' }), {
            status: 200,
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
          }),
        )
      }
      bookRequests += 1
      return Promise.resolve(booksResponse())
    })

    function Harness() {
      return (
        <YouVersionProvider appKey="test-key" permittedLanguageTags={['en']}>
          <BibleChapterPicker book="JHN" chapter="1" versionId={9106} />
        </YouVersionProvider>
      )
    }

    const { getByText, queryByLabelText, rerender } = render(<Harness />)
    await waitFor(() => expect(getByText('John')).toBeTruthy())
    expect(bookRequests).toBe(1)

    rerender(<Harness />)

    expect(queryByLabelText('Loading')).toBeNull()
    expect(getByText('John')).toBeTruthy()
    await act(async () => {
      await Promise.resolve()
    })
    expect(bookRequests).toBe(1)
  })

  it('scrolls the selected chapter back into view after the book order changes', async () => {
    const frames: FrameRequestCallback[] = []
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback)
      return frames.length
    })
    const scrollTo = jest.fn()
    jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(scrollTo)
    jest.spyOn(global, 'fetch').mockImplementation((input) => {
      if (String(input).includes('/v1/fonts/')) return Promise.resolve(fontResponse())
      return Promise.resolve(booksResponse())
    })

    const { getByText, UNSAFE_root } = render(
      <BibleChapterPicker book="JHN" chapter="2" versionId={9107} />,
      { wrapper: youVersionProviderWrapper() },
    )
    await waitFor(() => expect(getByText('John')).toBeTruthy())

    fireLayouts(UNSAFE_root)
    flushFrames(frames)
    expect(scrollTo).toHaveBeenCalledTimes(1)

    fireEvent.press(getByText('Alphabetical'))
    fireLayouts(UNSAFE_root)
    flushFrames(frames)

    expect(scrollTo).toHaveBeenCalledTimes(2)
  })
})

function fireLayouts(root: ReactTestInstance) {
  const nodes = root.findAll((node) => node.props.onLayout !== undefined)
  const layout = {
    nativeEvent: { layout: { x: 0, y: 80, width: 320, height: 48 } },
  }
  for (const node of nodes) {
    fireEvent(node, 'layout', layout)
  }
}

function flushFrames(frames: FrameRequestCallback[]) {
  const pending = frames.splice(0)
  act(() => {
    for (const callback of pending) callback(0)
  })
}
