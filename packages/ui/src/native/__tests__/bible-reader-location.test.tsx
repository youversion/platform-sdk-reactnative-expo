import { act, fireEvent, render } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { Pressable, Text, View } from 'react-native'

import { READER_LOCATION_PERSIST_KEY } from '../../lib/constants'
import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import {
  installBibleReaderTestImpls,
  resetImpls,
  setImpl,
} from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'

function MockDOM(props: {
  book?: string
  chapter?: string
  versionId?: number
  onBookChange?: (book: string) => Promise<void>
  onChapterChange?: (chapter: string) => Promise<void>
  onVersionChange?: (versionId: number) => Promise<void>
}) {
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
})
