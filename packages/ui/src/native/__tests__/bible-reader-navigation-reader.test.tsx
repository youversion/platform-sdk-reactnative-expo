import { act, fireEvent, render } from '@testing-library/react-native'
import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { Pressable, Text, View } from 'react-native'

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
import { createBibleReaderNavigation } from '../bible-reader-navigation'

type LatestReaderDomProps = {
  book?: string
  chapter?: string
  versionId?: number
  onChapterChange?: (chapter: string) => Promise<void>
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

async function resetReaderLocationStore() {
  mmkvStorage.clearAll()
  useReaderLocationStore.setState(readerLocationStoreInitialState)
  await useReaderLocationStore.persist.rehydrate()
}

describe('BibleReader navigation', () => {
  beforeEach(async () => {
    latestReaderDomProps = {}
    installBibleReaderTestImpls()
    setImpl('BibleReaderDom', MockDOM)
    await resetReaderLocationStore()
  })

  afterEach(() => {
    resetImpls()
    jest.restoreAllMocks()
  })

  it('applies a request made before mount on the first render', () => {
    const navigation = createBibleReaderNavigation()
    navigation.request({ versionId: 111, bookId: 'PSA', chapter: 23, verse: 1 })

    const { getByTestId } = render(<BibleReader navigation={navigation} />, { wrapper })

    expect(getByTestId('book').props.children).toBe('PSA')
    expect(getByTestId('chapter').props.children).toBe('23')
    expect(getByTestId('version-id').props.children).toBe('111')
  })

  it('lets a newer request replace an older one before mount', () => {
    const navigation = createBibleReaderNavigation()
    navigation.request({ versionId: 59, bookId: 'GEN', chapter: 1, verse: 1 })
    navigation.request({ versionId: 111, bookId: 'PSA', chapter: 23, verse: 1 })

    const { getByTestId } = render(<BibleReader navigation={navigation} />, { wrapper })

    expect(getByTestId('book').props.children).toBe('PSA')
    expect(getByTestId('chapter').props.children).toBe('23')
    expect(getByTestId('version-id').props.children).toBe('111')
  })

  it('consumes a request once so a later render does not re-apply it', async () => {
    const navigation = createBibleReaderNavigation()
    navigation.request({ versionId: 111, bookId: 'PSA', chapter: 23, verse: 1 })

    const { getByTestId, rerender } = render(<BibleReader navigation={navigation} />, { wrapper })

    expect(navigation.pendingRequest).toBeNull()
    expect(getByTestId('book').props.children).toBe('PSA')
    expect(getByTestId('chapter').props.children).toBe('23')

    rerender(<BibleReader navigation={navigation} />)

    expect(navigation.pendingRequest).toBeNull()
    expect(getByTestId('chapter').props.children).toBe('23')

    await act(async () => {
      fireEvent.press(getByTestId('trigger-chapter-change'))
    })

    expect(getByTestId('book').props.children).toBe('PSA')
    expect(getByTestId('chapter').props.children).toBe('5')
    expect(getByTestId('version-id').props.children).toBe('111')
  })

  it('request and focusReference both change chapter and version when the reference differs', async () => {
    const navigation = createBibleReaderNavigation()

    const { getByTestId } = render(
      <BibleReader
        navigation={navigation}
        defaultBook="JHN"
        defaultChapter="1"
        defaultVersionId={111}
      />,
      { wrapper },
    )

    expect(getByTestId('book').props.children).toBe('JHN')
    expect(getByTestId('chapter').props.children).toBe('1')
    expect(getByTestId('version-id').props.children).toBe('111')

    await act(async () => {
      navigation.request({ versionId: 111, bookId: 'MAT', chapter: 5, verse: 1 })
    })

    expect(getByTestId('book').props.children).toBe('MAT')
    expect(getByTestId('chapter').props.children).toBe('5')
    expect(getByTestId('version-id').props.children).toBe('111')

    await act(async () => {
      navigation.focusReference({ versionId: 59, bookId: 'ROM', chapter: 8, verse: 1 })
    })

    expect(getByTestId('book').props.children).toBe('ROM')
    expect(getByTestId('chapter').props.children).toBe('8')
    expect(getByTestId('version-id').props.children).toBe('59')
  })

  it('consumes a same-location request without rewriting the DOM location', async () => {
    const navigation = createBibleReaderNavigation()
    const onBookChange = jest.fn()
    const onChapterChange = jest.fn()
    const onVersionChange = jest.fn()

    const { getByTestId } = render(
      <BibleReader
        navigation={navigation}
        defaultBook="JHN"
        defaultChapter="1"
        defaultVersionId={111}
        onBookChange={onBookChange}
        onChapterChange={onChapterChange}
        onVersionChange={onVersionChange}
      />,
      { wrapper },
    )

    await act(async () => {
      navigation.request({ versionId: 111, bookId: 'JHN', chapter: 1, verse: 16 })
    })

    expect(navigation.pendingRequest).toBeNull()
    expect(getByTestId('book').props.children).toBe('JHN')
    expect(getByTestId('chapter').props.children).toBe('1')
    expect(getByTestId('version-id').props.children).toBe('111')
    expect(onBookChange).not.toHaveBeenCalled()
    expect(onChapterChange).not.toHaveBeenCalled()
    expect(onVersionChange).not.toHaveBeenCalled()
  })

  it('does not add scroll or focus props on the DOM mock', () => {
    const navigation = createBibleReaderNavigation()
    navigation.request({ versionId: 111, bookId: 'JHN', chapter: 3, verse: 16 })
    navigation.focusReference({ versionId: 111, bookId: 'JHN', chapter: 3, verse: 16 }, true)

    render(<BibleReader navigation={navigation} />, { wrapper })

    expect(latestReaderDomProps.book).toBe('JHN')
    expect(latestReaderDomProps.chapter).toBe('3')
    expect(latestReaderDomProps.versionId).toBe(111)
    expect(latestReaderDomProps).not.toHaveProperty('scrollsToVerse')
    expect(latestReaderDomProps).not.toHaveProperty('shouldFocus')
    expect(latestReaderDomProps).not.toHaveProperty('scrollTarget')
    expect(latestReaderDomProps).not.toHaveProperty('focusedVerse')
    expect(latestReaderDomProps).not.toHaveProperty('showsFullChapter')
  })
})
