import type { BibleReference } from '@youversion/platform-react-native-expo-core'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Pressable, Text, View } from 'react-native'

import {
  installBibleReaderTestImpls,
  resetImpls,
  setImpl,
} from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'
import { createBibleReaderNavigation } from '../bible-reader-navigation'
import type { BibleReaderSearchSheetProps } from '../bible-reader-search-sheet'

type ReaderDomCapture = {
  book?: string
  chapter?: string
  versionId?: number
}

let latestSearchProps: BibleReaderSearchSheetProps | null = null
let latestReaderDomProps: ReaderDomCapture = {}

function CaptureSearchSheet(props: BibleReaderSearchSheetProps) {
  latestSearchProps = props
  if (!props.isOpen) {
    return <View testID="mock-search-sheet" />
  }
  return (
    <View testID="mock-search-sheet-open">
      <Pressable
        testID="select-good-usfm"
        onPress={() =>
          props.onSelectReference({ versionId: 111, bookId: 'PSA', chapter: 23, verse: 1 })
        }
      >
        <Text>Select good</Text>
      </Pressable>
      <Pressable
        testID="select-bad-usfm"
        onPress={() => {
          // The real sheet no-ops malformed USFM before calling onSelectReference.
        }}
      >
        <Text>Select bad</Text>
      </Pressable>
    </View>
  )
}

function MockDOM(props: ReaderDomCapture) {
  latestReaderDomProps = props
  return (
    <View testID="mock-dom">
      <Text testID="book">{props.book ?? 'none'}</Text>
      <Text testID="chapter">{props.chapter ?? 'none'}</Text>
      <Text testID="version-id">{String(props.versionId ?? 'none')}</Text>
    </View>
  )
}

const wrapper = youVersionProviderWrapper()

describe('BibleReader native Search button', () => {
  beforeEach(() => {
    latestSearchProps = null
    latestReaderDomProps = {}
    installBibleReaderTestImpls()
    setImpl('BibleReaderDom', MockDOM)
    setImpl('BibleReaderSearchSheet', CaptureSearchSheet)
  })

  afterEach(() => {
    resetImpls()
  })

  it('shows the Search button when the toolbar is on', () => {
    render(<BibleReader showToolbar />, { wrapper })

    expect(screen.getByTestId('bible-reader-search-button')).toBeTruthy()
    expect(screen.getByLabelText('Search')).toBeTruthy()
  })

  it('hides the Search button when showToolbar is false', () => {
    render(<BibleReader showToolbar={false} />, { wrapper })

    expect(screen.queryByTestId('bible-reader-search-button')).toBeNull()
    expect(screen.queryByTestId('mock-search-sheet')).toBeNull()
  })

  it('dismisses Search and requests the chapter on a result tap', async () => {
    const navigation = createBibleReaderNavigation()
    const request = jest.spyOn(navigation, 'request')

    render(
      <BibleReader
        navigation={navigation}
        defaultBook="JHN"
        defaultChapter="1"
        defaultVersionId={111}
      />,
      { wrapper },
    )

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-button'))
    })
    expect(screen.getByTestId('mock-search-sheet-open')).toBeTruthy()

    await act(async () => {
      fireEvent.press(screen.getByTestId('select-good-usfm'))
    })

    expect(request).toHaveBeenCalledWith({
      versionId: 111,
      bookId: 'PSA',
      chapter: 23,
      verse: 1,
    } satisfies BibleReference)
    expect(screen.getByTestId('book').props.children).toBe('PSA')
    expect(screen.getByTestId('chapter').props.children).toBe('23')
    expect(screen.queryByTestId('mock-search-sheet-open')).toBeNull()
  })

  it('jumps chapters through an internal navigation object when the host omits one', async () => {
    render(<BibleReader defaultBook="JHN" defaultChapter="1" defaultVersionId={111} />, {
      wrapper,
    })

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-button'))
    })
    await act(async () => {
      fireEvent.press(screen.getByTestId('select-good-usfm'))
    })

    expect(latestReaderDomProps.book).toBe('PSA')
    expect(latestReaderDomProps.chapter).toBe('23')
    expect(latestReaderDomProps.versionId).toBe(111)
  })

  it('leaves Search open when a malformed USFM is ignored', async () => {
    render(<BibleReader />, { wrapper })

    await act(async () => {
      fireEvent.press(screen.getByTestId('bible-reader-search-button'))
    })
    await act(async () => {
      fireEvent.press(screen.getByTestId('select-bad-usfm'))
    })

    expect(screen.getByTestId('mock-search-sheet-open')).toBeTruthy()
    expect(latestSearchProps?.isOpen).toBe(true)
  })
})
