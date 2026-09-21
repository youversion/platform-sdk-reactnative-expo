import { act, fireEvent, render, waitFor } from '@testing-library/react-native'

import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleChapterPicker } from '../bible-chapter-picker'

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
      <BibleChapterPicker book="JHN" chapter="2" versionId={9101} />,
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

    await act(async () => rejectSelection(new Error('not saved')))
    expect(getByLabelText('John 2').props.accessibilityState).toMatchObject({ disabled: false })
  })

  it('retries request failures and distinguishes a valid empty book list', async () => {
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

    await waitFor(() => expect(getByText('No books available')).toBeTruthy())
    expect(bookRequests).toBe(2)
    expect(fetchSpy).toHaveBeenCalled()
  })
})
