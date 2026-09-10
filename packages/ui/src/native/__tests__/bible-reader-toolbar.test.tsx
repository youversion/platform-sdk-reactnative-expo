import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type {
  BibleChapterPickerPressData,
  BibleVersionPickerPressData,
} from '@youversion/platform-react-ui'
import { Alert, Image, Pressable, Text, View } from 'react-native'

import en from '../../i18n/locales/en.json'
import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { signedOutAuth } from '../../test-utils/default-hook-overrides'
import {
  installBibleReaderTestImpls,
  resetImpls,
  setImpl,
} from '../../test-utils/install-test-impls'
import { restoreViewMeasure, stubViewMeasure } from '../../test-utils/stub-view-measure'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'

type LatestDomProps = {
  showToolbar?: boolean
  book?: string
  chapter?: string
  versionId?: number
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onChapterPickerPress?: (data: BibleChapterPickerPressData) => Promise<void>
}

let latestDomProps: LatestDomProps = {}

function MockDOM(props: LatestDomProps) {
  latestDomProps = props
  return (
    <View testID="mock-dom">
      <Pressable
        testID="trigger-version-picker"
        onPress={() => {
          if (props.onVersionPickerPress) {
            void props.onVersionPickerPress({ versionId: 3034, languageId: 'eng' })
          }
        }}
      >
        <Text>VersionPicker</Text>
      </Pressable>
    </View>
  )
}

const signOut = jest.fn(async () => undefined)
const signIn = jest.fn(async () => undefined)

const signedInAuth = signedOutAuth({
  isAuthenticated: true,
  accessToken: 'test-token',
  userInfo: { id: 'user-1', name: 'Jane Doe', avatarUrl: 'https://cdn.example.com/a.png' },
  signIn,
  signOut,
  getAccessToken: async () => ({ status: 'ok', token: 'test-token', userId: 'user-1' }),
  requestedPermissions: ['highlights'],
  grantedPermissions: ['highlights'],
  hasPermission: () => true,
})

const defaultWrapper = youVersionProviderWrapper()
const signedInWrapper = youVersionProviderWrapper('light', undefined, { useYVAuth: signedInAuth })
const signedOutWrapper = youVersionProviderWrapper('light', undefined, {
  useYVAuth: signedOutAuth({ signIn }),
})
const unconfiguredWrapper = youVersionProviderWrapper('light', undefined, { useYVAuth: null })

const user = userEvent.setup()
const setupFetch = jest.mocked(global.fetch)
const defaultFetchImpl = setupFetch.getMockImplementation()

function ensureSetupFetch(): jest.MockedFunction<typeof fetch> {
  if (global.fetch !== setupFetch) {
    global.fetch = setupFetch
  }
  return setupFetch
}

function urlFromFetchInput(input: RequestInfo | URL): string {
  if (input instanceof Request) {
    return input.url
  }
  if (input instanceof URL) {
    return input.href
  }
  return input
}

function restoreDefaultFetch() {
  const fetchMock = ensureSetupFetch()
  if (defaultFetchImpl) {
    fetchMock.mockImplementation(defaultFetchImpl)
  }
}

function isVersionUrl(url: string): boolean {
  return /\/v1\/bibles\/\d+(?:\?|$)/.test(url)
}

function isBooksCatalogUrl(url: string): boolean {
  return /\/v1\/bibles\/\d+\/books(?:\?|$)/.test(url)
}

function installToolbarFetches({
  abbreviation = 'NIV',
  languageTag = 'en',
  books = [{ id: 'JHN', title: 'John', chapters: [{ id: '1' }, { id: '2' }] }],
}: {
  abbreviation?: string
  languageTag?: string
  books?: unknown[]
} = {}) {
  ensureSetupFetch().mockImplementation((input: RequestInfo | URL) => {
    const url = urlFromFetchInput(input)
    if (isVersionUrl(url) && url.includes('/3034')) {
      return Promise.resolve(
        new Response(JSON.stringify({ abbreviation, language_tag: languageTag }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
        }),
      )
    }
    if (isBooksCatalogUrl(url) && url.includes('/3034/')) {
      return Promise.resolve(
        new Response(JSON.stringify({ data: books }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
        }),
      )
    }
    if (url.includes('/v1/fonts/')) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ id: 1, slug: 'untitled-serif', family: 'Untitled Serif', variants: [] }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        ),
      )
    }
    return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
  })
}

function installOpenAwareSheets() {
  installBibleReaderTestImpls()
  setImpl('BibleReaderDom', MockDOM)
  setImpl('BibleChapterPickerSheet', ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <View testID="mock-chapter-picker-sheet" /> : null,
  )
  setImpl('BibleVersionPickerSheet', ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <View testID="mock-version-picker-sheet" /> : null,
  )
  setImpl(
    'BibleReaderSettingsSheet',
    ({ isSettingsSheetOpen }: { isSettingsSheetOpen: boolean }) =>
      isSettingsSheetOpen ? <View testID="mock-settings-sheet" /> : null,
  )
}

async function openUserMenu() {
  const avatar = screen.queryByTestId('reader-toolbar-avatar')
  if (avatar) {
    await user.press(avatar)
    return
  }
  await user.press(screen.getByTestId('reader-toolbar-user'))
}

describe('BibleReader native toolbar', () => {
  beforeEach(async () => {
    stubViewMeasure()
    latestDomProps = {}
    signOut.mockClear()
    signIn.mockClear()
    installOpenAwareSheets()
    mmkvStorage.clearAll()
    restoreDefaultFetch()
    ensureSetupFetch().mockClear()
    useReaderLocationStore.setState(readerLocationStoreInitialState)
    await useReaderLocationStore.persist.rehydrate()
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  })

  afterEach(async () => {
    await act(async () => {
      await Promise.resolve()
    })
    resetImpls()
    restoreViewMeasure()
    jest.restoreAllMocks()
    restoreDefaultFetch()
  })

  it('renders the native row and hides the in-WebView toolbar', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: defaultWrapper })

    expect(screen.getByTestId('reader-toolbar')).toBeTruthy()
    expect(screen.getByTestId('reader-toolbar-previous-chapter')).toBeTruthy()
    expect(screen.getByTestId('reader-toolbar-next-chapter')).toBeTruthy()
    expect(screen.getByTestId('reader-toolbar-settings')).toBeTruthy()
    expect(latestDomProps.showToolbar).toBe(false)
    await waitFor(() => {
      expect(screen.queryByTestId('reader-toolbar-chapter-loading')).toBeNull()
    })
  })

  it('shows the version abbreviation on the version button', async () => {
    installToolbarFetches()

    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: defaultWrapper })

    expect(screen.getByTestId('reader-toolbar-version-loading')).toBeTruthy()
    expect(screen.queryByText('3034')).toBeNull()
    await waitFor(() => {
      expect(screen.getByText('NIV')).toBeTruthy()
    })
    expect(screen.queryByTestId('reader-toolbar-version-loading')).toBeNull()
  })

  it('shows the full book name on the chapter button', async () => {
    installToolbarFetches()

    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: defaultWrapper })

    expect(screen.getByTestId('reader-toolbar-chapter-loading')).toBeTruthy()
    expect(screen.queryByText('1')).toBeNull()
    await waitFor(() => {
      expect(screen.getByText('John 1')).toBeTruthy()
    })
    expect(screen.queryByTestId('reader-toolbar-chapter-loading')).toBeNull()
  })

  it('spins the chapter and version buttons until the new version labels land', async () => {
    let releaseBooks: ((response: Response) => void) | undefined
    let releaseVersion: ((response: Response) => void) | undefined
    const booksPending = new Promise<Response>((resolve) => {
      releaseBooks = resolve
    })
    const versionPending = new Promise<Response>((resolve) => {
      releaseVersion = resolve
    })
    ensureSetupFetch().mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/3034')) {
        return Promise.resolve(
          new Response(JSON.stringify({ abbreviation: 'NIV', language_tag: 'en' }), {
            status: 200,
            headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
          }),
        )
      }
      if (isVersionUrl(url) && url.includes('/128')) {
        return versionPending
      }
      if (isBooksCatalogUrl(url) && url.includes('/3034/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: [{ id: 'JHN', title: 'John', chapters: [{ id: '1' }, { id: '2' }] }],
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
            },
          ),
        )
      }
      if (isBooksCatalogUrl(url) && url.includes('/128/')) {
        return booksPending
      }
      if (url.includes('/v1/fonts/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              slug: 'untitled-serif',
              family: 'Untitled Serif',
              variants: [],
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
        )
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const { rerender } = render(<BibleReader book="JHN" chapter="1" versionId={3034} />, {
      wrapper: defaultWrapper,
    })
    await waitFor(() => {
      expect(screen.getByText('John 1')).toBeTruthy()
      expect(screen.getByText('NIV')).toBeTruthy()
    })

    rerender(<BibleReader book="JHN" chapter="1" versionId={128} />)
    expect(screen.getByTestId('reader-toolbar-chapter-loading')).toBeTruthy()
    expect(screen.getByTestId('reader-toolbar-version-loading')).toBeTruthy()
    expect(screen.queryByText('3034')).toBeNull()
    expect(screen.queryByText('128')).toBeNull()
    // The last title can stay on the button. Next cannot keep walking NIV's chapters.
    expect(
      screen.getByTestId('reader-toolbar-next-chapter').props.accessibilityState,
    ).toMatchObject({ disabled: true })

    await act(async () => {
      releaseVersion?.(
        new Response(
          JSON.stringify({
            abbreviation: 'NIV',
            localized_abbreviation: 'NVI',
            language_tag: 'es',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
          },
        ),
      )
      releaseBooks?.(
        new Response(
          JSON.stringify({
            data: [{ id: 'JHN', title: 'Juan', chapters: [{ id: '1' }, { id: '2' }] }],
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
          },
        ),
      )
    })
    await waitFor(() => {
      expect(screen.getByText('Juan 1')).toBeTruthy()
      expect(screen.getByText('NVI')).toBeTruthy()
    })
    expect(
      screen.getByTestId('reader-toolbar-next-chapter').props.accessibilityState,
    ).not.toMatchObject({ disabled: true })

    rerender(<BibleReader book="JHN" chapter="1" versionId={3034} />)
    expect(screen.getByText('John 1')).toBeTruthy()
    expect(screen.getByText('NIV')).toBeTruthy()
    expect(screen.queryByTestId('reader-toolbar-chapter-loading')).toBeNull()
    expect(screen.queryByTestId('reader-toolbar-version-loading')).toBeNull()
    await waitFor(() => {
      expect(screen.getByText('John 1')).toBeTruthy()
      expect(screen.getByText('NIV')).toBeTruthy()
    })
  })

  it('opens the chapter and version sheets from the native row', async () => {
    installToolbarFetches()

    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: defaultWrapper })

    expect(screen.queryByTestId('mock-chapter-picker-sheet')).toBeNull()
    expect(screen.queryByTestId('mock-version-picker-sheet')).toBeNull()

    await waitFor(() => {
      expect(screen.getByText('John 1')).toBeTruthy()
      expect(screen.getByText('NIV')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-chapter'))
    })
    expect(screen.getByTestId('mock-chapter-picker-sheet')).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-version'))
    })
    expect(screen.getByTestId('mock-version-picker-sheet')).toBeTruthy()
  })

  it('opens settings from the gear', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: defaultWrapper })

    expect(screen.queryByTestId('mock-settings-sheet')).toBeNull()

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-settings'))
    })
    expect(screen.getByTestId('mock-settings-sheet')).toBeTruthy()
  })

  it('lets escape hatches suppress the built-in picker sheets', async () => {
    const onChapterPickerPress = jest.fn().mockResolvedValue(undefined)
    const onVersionPickerPress = jest.fn().mockResolvedValue(undefined)
    installToolbarFetches({ languageTag: 'en' })

    render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={3034}
        onChapterPickerPress={onChapterPickerPress}
        onVersionPickerPress={onVersionPickerPress}
      />,
      { wrapper: defaultWrapper },
    )

    await waitFor(() => {
      expect(screen.getByText('NIV')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-chapter'))
    })
    expect(onChapterPickerPress).toHaveBeenCalledWith({
      book: 'JHN',
      chapter: '1',
      versionId: 3034,
    })
    expect(screen.queryByTestId('mock-chapter-picker-sheet')).toBeNull()

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-version'))
    })
    expect(onVersionPickerPress).toHaveBeenCalledWith({ versionId: 3034, languageId: 'en' })
    expect(screen.queryByTestId('mock-version-picker-sheet')).toBeNull()
  })

  it('does not call onVersionPickerPress until the language tag lands', async () => {
    let releaseVersion: ((response: Response) => void) | undefined
    const versionPending = new Promise<Response>((resolve) => {
      releaseVersion = resolve
    })
    ensureSetupFetch().mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (isVersionUrl(url) && url.includes('/3034')) {
        return versionPending
      }
      if (isBooksCatalogUrl(url) && url.includes('/3034/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ data: [{ id: 'JHN', title: 'John', chapters: [{ id: '1' }] }] }),
            {
              status: 200,
              headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
            },
          ),
        )
      }
      if (url.includes('/v1/fonts/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              slug: 'untitled-serif',
              family: 'Untitled Serif',
              variants: [],
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
        )
      }
      return Promise.reject(new Error(`unexpected fetch in UI tests: ${url}`))
    })

    const onVersionPickerPress = jest.fn().mockResolvedValue(undefined)
    render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={3034}
        onVersionPickerPress={onVersionPickerPress}
      />,
      { wrapper: defaultWrapper },
    )

    await waitFor(() => {
      expect(screen.getByTestId('reader-toolbar-version-loading')).toBeTruthy()
    })
    expect(screen.getByTestId('reader-toolbar-version').props.accessibilityState).toMatchObject({
      disabled: true,
    })

    // The disabled trigger is what holds the callback back, so press it mid-flight: a consumer
    // must never be handed a half-loaded selection.
    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-version'))
    })
    expect(onVersionPickerPress).not.toHaveBeenCalled()

    await act(async () => {
      releaseVersion?.(
        new Response(JSON.stringify({ abbreviation: 'NIV', language_tag: 'en' }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText('NIV')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-version'))
    })
    expect(onVersionPickerPress).toHaveBeenCalledWith({ versionId: 3034, languageId: 'en' })
  })

  it('clears both spinners when the toolbar lookups fail', async () => {
    ensureSetupFetch().mockImplementation((input: RequestInfo | URL) => {
      const url = urlFromFetchInput(input)
      if (url.includes('/v1/fonts/')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: 1,
              slug: 'untitled-serif',
              family: 'Untitled Serif',
              variants: [],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
      }
      return Promise.reject(new Error('network down'))
    })

    const onVersionPickerPress = jest.fn().mockResolvedValue(undefined)
    render(
      <BibleReader
        book="JHN"
        chapter="1"
        versionId={3034}
        onVersionPickerPress={onVersionPickerPress}
      />,
      { wrapper: defaultWrapper },
    )

    // Both lookups reject and the spinners keep animating meanwhile, so this settles slower
    // than the happy paths above — the default one-second window is tight under a full run.
    await waitFor(
      () => {
        expect(screen.queryByTestId('reader-toolbar-version-loading')).toBeNull()
        expect(screen.queryByTestId('reader-toolbar-chapter-loading')).toBeNull()
      },
      { timeout: 3000 },
    )
    // No catalog and no version meta: the version pill stays empty; the chapter pill shows the id.
    expect(screen.queryByText('3034')).toBeNull()
    expect(screen.getByText('1')).toBeTruthy()

    // Both chevrons stay off without a catalog to walk.
    expect(
      screen.getByTestId('reader-toolbar-previous-chapter').props.accessibilityState,
    ).toMatchObject({ disabled: true })
    expect(
      screen.getByTestId('reader-toolbar-next-chapter').props.accessibilityState,
    ).toMatchObject({ disabled: true })

    // The trigger re-enables once the lookup settles, failed or not. `BibleVersionPickerPressData`
    // types `languageId` as a string for Web SDK parity, so a failed lookup sends it empty.
    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-version'))
    })
    expect(onVersionPickerPress).toHaveBeenCalledWith({ versionId: 3034, languageId: '' })
  })

  it('omits the row and built-in sheets when showToolbar is false', () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} showToolbar={false} />, {
      wrapper: defaultWrapper,
    })

    expect(screen.queryByTestId('reader-toolbar')).toBeNull()
    expect(screen.queryByTestId('mock-chapter-picker-sheet')).toBeNull()
    expect(screen.queryByTestId('mock-version-picker-sheet')).toBeNull()
    expect(screen.queryByTestId('mock-settings-sheet')).toBeNull()
    expect(
      ensureSetupFetch().mock.calls.some(([input]) => isVersionUrl(urlFromFetchInput(input))),
    ).toBe(false)
    expect(
      ensureSetupFetch().mock.calls.some(([input]) => isBooksCatalogUrl(urlFromFetchInput(input))),
    ).toBe(false)
  })

  it('keeps next off until the book list says how many chapters', async () => {
    installToolbarFetches({ books: [] })

    render(<BibleReader defaultBook="JHN" defaultChapter="1" defaultVersionId={3034} />, {
      wrapper: defaultWrapper,
    })

    expect(
      screen.getByTestId('reader-toolbar-next-chapter').props.accessibilityState,
    ).toMatchObject({ disabled: true })
    await waitFor(() => {
      expect(screen.getByText('1')).toBeTruthy()
    })
    expect(
      screen.getByTestId('reader-toolbar-next-chapter').props.accessibilityState,
    ).toMatchObject({ disabled: true })
  })

  it('keeps next off when the book list has a title but no chapters', async () => {
    installToolbarFetches({ books: [{ id: 'JHN', title: 'John' }] })

    render(<BibleReader defaultBook="JHN" defaultChapter="1" defaultVersionId={3034} />, {
      wrapper: defaultWrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('John 1')).toBeTruthy()
    })
    expect(
      screen.getByTestId('reader-toolbar-next-chapter').props.accessibilityState,
    ).toMatchObject({ disabled: true })
  })

  it('steps chapter with chevrons and opens the next book at the last chapter', async () => {
    installToolbarFetches({
      books: [
        { id: 'JHN', title: 'John', chapters: [{ id: '1' }, { id: '2' }] },
        { id: 'ACT', title: 'Acts', chapters: [{ id: '1' }] },
      ],
    })

    render(<BibleReader defaultBook="JHN" defaultChapter="1" defaultVersionId={3034} />, {
      wrapper: defaultWrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('John 1')).toBeTruthy()
    })

    expect(
      screen.getByTestId('reader-toolbar-previous-chapter').props.accessibilityState,
    ).toMatchObject({ disabled: true })
    expect(
      screen.getByTestId('reader-toolbar-next-chapter').props.accessibilityState,
    ).not.toMatchObject({ disabled: true })

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-next-chapter'))
    })
    expect(latestDomProps.book).toBe('JHN')
    expect(latestDomProps.chapter).toBe('2')
    expect(screen.getByText('John 2')).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-next-chapter'))
    })
    expect(latestDomProps.book).toBe('ACT')
    expect(latestDomProps.chapter).toBe('1')
    expect(useReaderLocationStore.getState()).toMatchObject({ book: 'ACT', chapter: '1' })
    expect(screen.getByText('Acts 1')).toBeTruthy()
    expect(
      screen.getByTestId('reader-toolbar-next-chapter').props.accessibilityState,
    ).toMatchObject({ disabled: true })

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-previous-chapter'))
    })
    expect(latestDomProps.book).toBe('JHN')
    expect(latestDomProps.chapter).toBe('2')
    expect(screen.getByText('John 2')).toBeTruthy()
  })

  it('shows Avatar when signed in and routes press through the sign-out guard', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: signedInWrapper })

    expect(screen.getByTestId('reader-toolbar-avatar')).toBeTruthy()
    expect(screen.queryByTestId('reader-toolbar-user')).toBeNull()

    // The photo layers over the initials rather than replacing them, so a slow or broken
    // avatar url still paints a face instead of an empty circle.
    expect(screen.getByText('JD')).toBeTruthy()
    const photos = screen.getByTestId('reader-toolbar-avatar').findAllByType(Image)
    expect(photos).toHaveLength(1)
    expect(photos[0]?.props.source).toEqual({ uri: 'https://cdn.example.com/a.png' })

    await openUserMenu()
    expect(screen.getByText(en.signOut, { includeHiddenElements: true })).toBeTruthy()
    expect(screen.queryByText(en.signIn, { includeHiddenElements: true })).toBeNull()

    await user.press(screen.getByTestId('reader-toolbar-sign-out', { includeHiddenElements: true }))

    const call = jest.mocked(Alert.alert).mock.calls[0]
    expect(call?.[0]).toBe(en.signOutQuestion)
    expect(signOut).not.toHaveBeenCalled()
  })

  it('shows the person control when signed out with auth configured and calls signIn', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: signedOutWrapper })

    expect(screen.getByTestId('reader-toolbar-user')).toBeTruthy()
    expect(screen.queryByTestId('reader-toolbar-avatar')).toBeNull()

    await openUserMenu()
    expect(screen.getByText(en.signIn, { includeHiddenElements: true })).toBeTruthy()
    expect(screen.queryByText(en.signOut, { includeHiddenElements: true })).toBeNull()

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-sign-in', { includeHiddenElements: true }))
    })
    expect(signIn).toHaveBeenCalledTimes(1)
  })

  it('hides the avatar and sign-in control when auth is unconfigured', () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, {
      wrapper: unconfiguredWrapper,
    })

    expect(screen.getByTestId('reader-toolbar-settings')).toBeTruthy()
    expect(screen.queryByTestId('reader-toolbar-avatar')).toBeNull()
    expect(screen.queryByTestId('reader-toolbar-user')).toBeNull()
    expect(screen.queryByText(en.signIn)).toBeNull()
    expect(screen.queryByText(en.signOut)).toBeNull()
  })
})
