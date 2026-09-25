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

type VerseFocus = {
  seq: number
  versionId: number
  passageId: string
  scrollsToVerse: boolean
  shouldFocus: boolean
}

type LatestReaderDomProps = {
  book?: string
  chapter?: string
  versionId?: number
  verseFocus?: VerseFocus
  appliedFocusSeq?: number
  onVerseFocusApplied?: (seq: number) => void
  onChapterChange?: (chapter: string) => Promise<void>
}

let latestReaderDomProps: LatestReaderDomProps = {}
const appliedFocusSeqs: number[] = []

function MockDOM(props: LatestReaderDomProps) {
  latestReaderDomProps = props
  appliedFocusSeqs.push(props.appliedFocusSeq ?? -1)
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
    appliedFocusSeqs.length = 0
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

    expect(getByTestId('book').props.children).toBe('PSA')
    expect(getByTestId('chapter').props.children).toBe('23')

    rerender(<BibleReader navigation={navigation} />)

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

  it('persists a combined jump as one Reader Location', async () => {
    const originalSetLocation = useReaderLocationStore.getState().setLocation
    const patches: { book?: string; chapter?: string; versionId?: number }[] = []

    try {
      await act(async () => {
        useReaderLocationStore.setState({
          setLocation: (patch) => {
            patches.push(patch)
            originalSetLocation(patch)
          },
        })
      })

      const navigation = createBibleReaderNavigation()
      render(
        <BibleReader
          navigation={navigation}
          defaultBook="JHN"
          defaultChapter="1"
          defaultVersionId={111}
        />,
        { wrapper },
      )
      patches.length = 0

      await act(async () => {
        navigation.request({ versionId: 59, bookId: 'ROM', chapter: 8, verse: 1 })
      })

      expect(patches).toEqual([{ book: 'ROM', chapter: '8', versionId: 59 }])
      expect(useReaderLocationStore.getState()).toMatchObject({
        book: 'ROM',
        chapter: '8',
        versionId: 59,
      })
    } finally {
      await act(async () => {
        useReaderLocationStore.setState({ setLocation: originalSetLocation })
      })
    }
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

    expect(getByTestId('book').props.children).toBe('JHN')
    expect(getByTestId('chapter').props.children).toBe('1')
    expect(getByTestId('version-id').props.children).toBe('111')
    expect(onBookChange).not.toHaveBeenCalled()
    expect(onChapterChange).not.toHaveBeenCalled()
    expect(onVersionChange).not.toHaveBeenCalled()
  })

  it('forwards a serializable verse focus on the DOM mock', async () => {
    const navigation = createBibleReaderNavigation()
    navigation.request({ versionId: 111, bookId: 'JHN', chapter: 3, verse: 16 })

    render(<BibleReader navigation={navigation} />, { wrapper })

    expect(latestReaderDomProps.book).toBe('JHN')
    expect(latestReaderDomProps.chapter).toBe('3')
    expect(latestReaderDomProps.versionId).toBe(111)
    expect(latestReaderDomProps.verseFocus).toEqual({
      seq: 0,
      versionId: 111,
      passageId: 'JHN.3.16',
      scrollsToVerse: false,
      shouldFocus: false,
    })

    await act(async () => {
      navigation.focusReference({ versionId: 111, bookId: 'JHN', chapter: 3, verse: 16 }, true)
    })

    const focus = latestReaderDomProps.verseFocus
    expect(focus).toEqual({
      seq: 1,
      versionId: 111,
      passageId: 'JHN.3.16',
      scrollsToVerse: true,
      shouldFocus: true,
    })
    expect(JSON.parse(JSON.stringify(focus))).toEqual(focus)
    expect(Object.getPrototypeOf(focus)).toBe(Object.prototype)
  })

  it('keeps a range passage id instead of rebuilding it from the start verse', () => {
    const navigation = createBibleReaderNavigation()
    navigation.focusReference({
      versionId: 111,
      bookId: 'JHN',
      chapter: 3,
      verse: 16,
      passageId: 'JHN.3.16-18',
    })

    render(<BibleReader navigation={navigation} />, { wrapper })

    expect(latestReaderDomProps.verseFocus).toEqual({
      seq: 1,
      versionId: 111,
      passageId: 'JHN.3.16-18',
      scrollsToVerse: true,
      shouldFocus: true,
    })
    expect(appliedFocusSeqs.every((seq) => seq === 0)).toBe(true)
    expect(latestReaderDomProps.appliedFocusSeq).toBe(0)

    act(() => {
      latestReaderDomProps.onVerseFocusApplied?.(1)
    })

    expect(latestReaderDomProps.appliedFocusSeq).toBe(1)
  })

  it('keeps an acknowledged focus from replaying after the reader leaves and remounts', async () => {
    const navigation = createBibleReaderNavigation()
    navigation.focusReference({ versionId: 111, bookId: 'JHN', chapter: 3, verse: 16 })

    const first = render(<BibleReader navigation={navigation} />, { wrapper })

    expect(latestReaderDomProps.appliedFocusSeq).toBe(0)
    expect(latestReaderDomProps.verseFocus).toEqual({
      seq: 1,
      versionId: 111,
      passageId: 'JHN.3.16',
      scrollsToVerse: true,
      shouldFocus: true,
    })

    act(() => {
      latestReaderDomProps.onVerseFocusApplied?.(1)
    })
    expect(latestReaderDomProps.appliedFocusSeq).toBe(1)

    await act(async () => {
      fireEvent.press(first.getByTestId('trigger-chapter-change'))
    })
    expect(first.getByTestId('chapter').props.children).toBe('5')
    expect(latestReaderDomProps.verseFocus).toEqual({
      seq: 1,
      versionId: 111,
      passageId: 'JHN.3.16',
      scrollsToVerse: true,
      shouldFocus: true,
    })

    first.unmount()
    render(<BibleReader navigation={navigation} />, { wrapper })

    expect(latestReaderDomProps.verseFocus).toEqual({
      seq: 1,
      versionId: 111,
      passageId: 'JHN.3.16',
      scrollsToVerse: true,
      shouldFocus: true,
    })
    expect(latestReaderDomProps.appliedFocusSeq).toBe(1)

    await act(async () => {
      navigation.focusReference({ versionId: 111, bookId: 'ROM', chapter: 8, verse: 1 })
    })

    expect(latestReaderDomProps.verseFocus).toEqual({
      seq: 2,
      versionId: 111,
      passageId: 'ROM.8.1',
      scrollsToVerse: true,
      shouldFocus: true,
    })
    expect(latestReaderDomProps.appliedFocusSeq).toBe(1)

    act(() => {
      latestReaderDomProps.onVerseFocusApplied?.(2)
    })
    expect(latestReaderDomProps.appliedFocusSeq).toBe(2)
  })

  it('still forwards a focus that the DOM has not acknowledged after remount', () => {
    const navigation = createBibleReaderNavigation()
    navigation.focusReference({ versionId: 111, bookId: 'JHN', chapter: 3, verse: 16 })

    const first = render(<BibleReader navigation={navigation} />, { wrapper })
    expect(latestReaderDomProps.appliedFocusSeq).toBe(0)
    first.unmount()

    render(<BibleReader navigation={navigation} />, { wrapper })

    expect(latestReaderDomProps.verseFocus).toEqual({
      seq: 1,
      versionId: 111,
      passageId: 'JHN.3.16',
      scrollsToVerse: true,
      shouldFocus: true,
    })
    expect(latestReaderDomProps.appliedFocusSeq).toBe(0)
  })

  it('bumps seq when focusReference repeats the same verse', async () => {
    const navigation = createBibleReaderNavigation()
    navigation.focusReference({ versionId: 111, bookId: 'JHN', chapter: 3, verse: 16 })

    render(<BibleReader navigation={navigation} />, { wrapper })

    expect(latestReaderDomProps.verseFocus?.seq).toBe(1)

    await act(async () => {
      navigation.focusReference({ versionId: 111, bookId: 'JHN', chapter: 3, verse: 16 })
    })

    expect(latestReaderDomProps.verseFocus).toEqual({
      seq: 2,
      versionId: 111,
      passageId: 'JHN.3.16',
      scrollsToVerse: true,
      shouldFocus: true,
    })
  })
})
