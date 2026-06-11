import { act, fireEvent, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { READER_LOCATION_PERSIST_KEY } from '../../lib/constants'
import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import { BibleReader } from '../bible-reader'
import { YouVersionProvider } from '../youversion-provider'

jest.mock('../../dom/bible-reader', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, Text, Pressable } = require('react-native')
  return {
    __esModule: true,
    default: function MockDOM(props: {
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
    },
  }
})

jest.mock('../../dom/footnote-content', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: () => <View testID="mock-footnote" />,
  }
})

jest.mock('../bible-chapter-picker-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleChapterPickerSheet: () => <View testID="mock-chapter-picker-sheet" />,
  }
})

jest.mock('../bible-version-picker-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleVersionPickerSheet: () => <View testID="mock-version-picker-sheet" />,
  }
})

jest.mock('../native-sheet', () => {
  const actual = jest.requireActual('../native-sheet')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    ...actual,
    NativeSheet: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
      isOpen ? <View testID="sheet">{children}</View> : null,
  }
})

jest.mock('../bible-reader-settings-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native')
  return {
    __esModule: true,
    BibleReaderSettingsSheet: () => <View testID="mock-settings-sheet" />,
  }
})

jest.mock('../../stores/reader-settings-store', () => ({
  useReaderSettingsStore: () => ({
    fontSize: 16,
    fontFamily: '"Inter", sans-serif',
    setFontSize: jest.fn(),
    setFontFamily: jest.fn(),
  }),
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <YouVersionProvider appKey="test-key" theme="light">
    {children}
  </YouVersionProvider>
)

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
    await resetReaderLocationStore()
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
    const parsed = JSON.parse(raw!) as { state: { chapter?: string } }
    expect(parsed.state.chapter).toBe('5')
  })
})
