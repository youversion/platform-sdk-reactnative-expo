import { act, fireEvent, render } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import { READER_LOCATION_PERSIST_KEY } from '../../lib/constants'
import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import {
  installBibleReaderTestImpls,
  resetImpls,
  setImpl,
} from '../../test-utils/install-test-impls'
import { stubDeviceLocale } from '../../test-utils/stub-device-locale'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

type LatestReaderDomProps = {
  book?: string
  chapter?: string
  versionId?: number
  locale?: string
  permittedVersionIds?: number[]
  excludedVersionIds?: number[]
  permittedLanguageTags?: string[]
  onBookChange?: (book: string) => Promise<void>
  onChapterChange?: (chapter: string) => Promise<void>
  onVersionChange?: (versionId: number) => Promise<void>
}

let latestReaderDomProps: LatestReaderDomProps = {}

function MockDOM(props: LatestReaderDomProps) {
  latestReaderDomProps = props
  return (
    <View testID="mock-dom">
      <Text testID="book">{props.book ?? 'none'}</Text>
      <Text testID="chapter">{props.chapter ?? 'none'}</Text>
      <Text testID="version-id">{String(props.versionId ?? 'none')}</Text>
      <Pressable testID="trigger-chapter-change" onPress={() => props.onChapterChange?.('5')}>
        <Text>Chapter</Text>
      </Pressable>
    </View>
  )
}

const wrapper = youVersionProviderWrapper()

const refuseFilterWrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider
    appKey="test-key"
    theme="light"
    permittedVersionIds={[]}
    hookOverrides={defaultHookOverrides}
  >
    {children}
  </YouVersionProvider>
)

function versionFilterWrapper(lists: {
  permittedVersionIds?: number[]
  excludedVersionIds?: number[]
  permittedLanguageTags?: string[]
}) {
  return function FilterWrapper({ children }: { children: ReactNode }) {
    return (
      <YouVersionProvider
        appKey="test-key"
        theme="light"
        hookOverrides={defaultHookOverrides}
        {...lists}
      >
        {children}
      </YouVersionProvider>
    )
  }
}

async function resetReaderLocationStore() {
  mmkvStorage.clearAll()
  useReaderLocationStore.setState(readerLocationStoreInitialState)
  await useReaderLocationStore.persist.rehydrate()
}

async function seedReaderLocation(location: { book: string; chapter: string; versionId: number }) {
  mmkvStorage.set(
    READER_LOCATION_PERSIST_KEY,
    JSON.stringify({
      state: location,
      version: 0,
    }),
  )
  await useReaderLocationStore.persist.rehydrate()
}

describe('BibleReader Reader Location persistence', () => {
  beforeEach(async () => {
    latestReaderDomProps = {}
    stubDeviceLocale('xx-XX', 'xx')
    installBibleReaderTestImpls()
    setImpl('BibleReaderDom', MockDOM)
    await resetReaderLocationStore()
  })

  afterEach(() => {
    resetImpls()
    jest.restoreAllMocks()
  })

  it('hydrates uncontrolled state from MMKV on mount', async () => {
    await seedReaderLocation({ book: 'GEN', chapter: '2', versionId: 59 })

    const { getByTestId } = render(<BibleReader />, { wrapper })

    expect(getByTestId('book').props.children).toBe('GEN')
    expect(getByTestId('chapter').props.children).toBe('2')
    expect(getByTestId('version-id').props.children).toBe('59')
  })

  it('uses consumer defaults when MMKV is empty', () => {
    const { getByTestId } = render(
      <BibleReader defaultBook="ROM" defaultChapter="8" defaultVersionId={111} />,
      { wrapper },
    )

    expect(getByTestId('book').props.children).toBe('ROM')
    expect(getByTestId('chapter').props.children).toBe('8')
    expect(getByTestId('version-id').props.children).toBe('111')
  })

  it('controlled props win over stored Reader Location', async () => {
    await seedReaderLocation({ book: 'GEN', chapter: '2', versionId: 59 })

    const { getByTestId } = render(<BibleReader book="PSA" chapter="23" versionId={111} />, {
      wrapper,
    })

    expect(getByTestId('book').props.children).toBe('PSA')
    expect(getByTestId('chapter').props.children).toBe('23')
    expect(getByTestId('version-id').props.children).toBe('111')
  })

  it('hydrates uncontrolled fields when only some props are controlled', async () => {
    await seedReaderLocation({ book: 'GEN', chapter: '2', versionId: 59 })

    const { getByTestId } = render(<BibleReader book="PSA" />, { wrapper })

    expect(getByTestId('book').props.children).toBe('PSA')
    expect(getByTestId('chapter').props.children).toBe('2')
    expect(getByTestId('version-id').props.children).toBe('59')
  })

  it('persists location changes from DOM onChapterChange', async () => {
    const { getByTestId } = render(<BibleReader />, { wrapper })

    await act(async () => {
      fireEvent.press(getByTestId('trigger-chapter-change'))
    })

    const raw = mmkvStorage.getString(READER_LOCATION_PERSIST_KEY)
    expect(raw).toBeTruthy()
    type PersistedLocation = { state: { chapter?: string } }
    const parsed: PersistedLocation = JSON.parse(raw!)
    expect(parsed.state.chapter).toBe('5')
  })

  it('passes a stored versionId into the DOM when version filter lists would refuse it', async () => {
    await seedReaderLocation({ book: 'GEN', chapter: '2', versionId: 59 })

    const { getByTestId } = render(<BibleReader />, { wrapper: refuseFilterWrapper })

    expect(getByTestId('version-id').props.children).toBe('59')

    const raw = mmkvStorage.getString(READER_LOCATION_PERSIST_KEY)
    expect(raw).toBeTruthy()
    if (raw === undefined) {
      throw new Error('expected persisted reader location')
    }
    // SAFETY: zustand persist writes `{ state, version }`; this test seeded versionId.
    const parsed = JSON.parse(raw) as { state: { versionId?: number } }
    expect(parsed.state.versionId).toBe(59)
  })

  it('passes a host versionId into the DOM when version filter lists would refuse it', () => {
    const { getByTestId } = render(<BibleReader versionId={59} />, { wrapper: refuseFilterWrapper })

    expect(getByTestId('version-id').props.children).toBe('59')
  })

  it('forwards version filter lists from YouVersionProvider to the DOM entry', () => {
    render(<BibleReader />, {
      wrapper: versionFilterWrapper({
        permittedVersionIds: [111],
        excludedVersionIds: [3034],
        permittedLanguageTags: ['en'],
      }),
    })

    expect(latestReaderDomProps.permittedVersionIds).toEqual([111])
    expect(latestReaderDomProps.excludedVersionIds).toEqual([3034])
    expect(latestReaderDomProps.permittedLanguageTags).toEqual(['en'])
  })

  it('forwards resolved locale from YouVersionProvider to the DOM entry', () => {
    render(<BibleReader />, {
      wrapper: youVersionProviderWrapper('light', 'es'),
    })

    expect(latestReaderDomProps.locale).toBe('es')
  })

  it('forwards device-resolved locale to the DOM entry when provider locale is omitted', () => {
    stubDeviceLocale('es-MX', 'es')

    render(<BibleReader />, { wrapper })

    expect(latestReaderDomProps.locale).toBe('es')
  })
})
