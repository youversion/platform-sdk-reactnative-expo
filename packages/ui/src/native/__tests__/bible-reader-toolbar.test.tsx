import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type {
  BibleChapterPickerPressData,
  BibleVersionPickerPressData,
} from '@youversion/platform-react-ui'
import { Alert, Pressable, Text, View } from 'react-native'

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
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'

type LatestDomProps = {
  showToolbar?: boolean
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
const fetchMock = jest.mocked(global.fetch)
const defaultFetchImpl = fetchMock.getMockImplementation()

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
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
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
        new Response(JSON.stringify({ id: 1, slug: 'untitled-serif', family: 'Untitled Serif', variants: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
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

async function openMoreMenu() {
  await user.press(screen.getByTestId('reader-toolbar-more'))
}

describe('BibleReader native toolbar', () => {
  beforeEach(async () => {
    latestDomProps = {}
    signOut.mockClear()
    signIn.mockClear()
    installOpenAwareSheets()
    mmkvStorage.clearAll()
    fetchMock.mockClear()
    useReaderLocationStore.setState(readerLocationStoreInitialState)
    await useReaderLocationStore.persist.rehydrate()
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
  })

  afterEach(async () => {
    await act(async () => {
      await Promise.resolve()
    })
    resetImpls()
    jest.restoreAllMocks()
    restoreDefaultFetch()
  })

  it('renders the native row and hides the in-WebView toolbar', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: defaultWrapper })

    expect(screen.getByTestId('reader-toolbar')).toBeTruthy()
    expect(screen.getByTestId('reader-toolbar-previous-chapter')).toBeTruthy()
    expect(screen.getByTestId('reader-toolbar-next-chapter')).toBeTruthy()
    expect(screen.getByLabelText(en.moreMenuAriaLabel)).toBeTruthy()
    expect(latestDomProps.showToolbar).toBe(false)
    await waitFor(() => {
      expect(screen.queryByTestId('reader-toolbar-chapter-loading')).toBeNull()
    })
  })

  it('shows the version abbreviation on the version button', async () => {
    installToolbarFetches()

    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: defaultWrapper })

    expect(screen.getByText('3034')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText('NIV')).toBeTruthy()
    })
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

  it('opens the chapter and version sheets from the native row', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: defaultWrapper })

    expect(screen.queryByTestId('mock-chapter-picker-sheet')).toBeNull()
    expect(screen.queryByTestId('mock-version-picker-sheet')).toBeNull()

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-chapter'))
    })
    expect(screen.getByTestId('mock-chapter-picker-sheet')).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-version'))
    })
    expect(screen.getByTestId('mock-version-picker-sheet')).toBeTruthy()
  })

  it('opens settings from the more menu', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: defaultWrapper })

    expect(screen.queryByTestId('mock-settings-sheet')).toBeNull()

    await openMoreMenu()
    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-settings', { includeHiddenElements: true }))
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

  it('omits the row and built-in sheets when showToolbar is false', () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} showToolbar={false} />, {
      wrapper: defaultWrapper,
    })

    expect(screen.queryByTestId('reader-toolbar')).toBeNull()
    expect(screen.queryByTestId('mock-chapter-picker-sheet')).toBeNull()
    expect(screen.queryByTestId('mock-version-picker-sheet')).toBeNull()
    expect(screen.queryByTestId('mock-settings-sheet')).toBeNull()
    expect(
      fetchMock.mock.calls.some(([input]) => isVersionUrl(urlFromFetchInput(input))),
    ).toBe(false)
    expect(
      fetchMock.mock.calls.some(([input]) => isBooksCatalogUrl(urlFromFetchInput(input))),
    ).toBe(false)
  })

  it('keeps next off until the book list says how many chapters', async () => {
    render(<BibleReader defaultBook="JHN" defaultChapter="1" defaultVersionId={3034} />, {
      wrapper: defaultWrapper,
    })

    expect(screen.getByTestId('reader-toolbar-next-chapter').props.accessibilityState).toMatchObject(
      { disabled: true },
    )
    await act(async () => {
      await Promise.resolve()
    })
  })

  it('steps chapter with chevrons in the current book and stops at the last chapter', async () => {
    installToolbarFetches()

    render(<BibleReader defaultBook="JHN" defaultChapter="1" defaultVersionId={3034} />, {
      wrapper: defaultWrapper,
    })

    await waitFor(() => {
      expect(screen.getByText('John 1')).toBeTruthy()
    })

    expect(screen.getByTestId('reader-toolbar-previous-chapter').props.accessibilityState).toMatchObject(
      { disabled: true },
    )
    expect(screen.getByTestId('reader-toolbar-next-chapter').props.accessibilityState).not.toMatchObject(
      { disabled: true },
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-next-chapter'))
    })
    expect(latestDomProps.chapter).toBe('2')
    expect(screen.getByText('John 2')).toBeTruthy()
    expect(screen.getByTestId('reader-toolbar-next-chapter').props.accessibilityState).toMatchObject(
      { disabled: true },
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-previous-chapter'))
    })
    expect(latestDomProps.chapter).toBe('1')
  })

  it('shows Sign out in the more menu when signed in and routes press through the sign-out guard', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: signedInWrapper })

    expect(screen.queryByTestId('reader-toolbar-avatar')).toBeNull()

    await openMoreMenu()
    expect(screen.getByText(en.signOut, { includeHiddenElements: true })).toBeTruthy()
    expect(screen.queryByText(en.signIn, { includeHiddenElements: true })).toBeNull()

    await user.press(screen.getByTestId('reader-toolbar-sign-out', { includeHiddenElements: true }))

    const call = jest.mocked(Alert.alert).mock.calls[0]
    expect(call?.[0]).toBe(en.signOutQuestion)
    expect(signOut).not.toHaveBeenCalled()
  })

  it('shows Sign in in the more menu when signed out with auth configured', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, { wrapper: signedOutWrapper })

    await openMoreMenu()
    expect(screen.getByText(en.signIn, { includeHiddenElements: true })).toBeTruthy()
    expect(screen.queryByText(en.signOut, { includeHiddenElements: true })).toBeNull()

    await act(async () => {
      fireEvent.press(screen.getByTestId('reader-toolbar-sign-in', { includeHiddenElements: true }))
    })
    expect(signIn).toHaveBeenCalledTimes(1)
  })

  it('hides sign-in and sign-out in the more menu when auth is unconfigured', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={3034} />, {
      wrapper: unconfiguredWrapper,
    })

    await openMoreMenu()
    expect(screen.getByTestId('reader-toolbar-settings', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.queryByText(en.signIn, { includeHiddenElements: true })).toBeNull()
    expect(screen.queryByText(en.signOut, { includeHiddenElements: true })).toBeNull()
  })
})
