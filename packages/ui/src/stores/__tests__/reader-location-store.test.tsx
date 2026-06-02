import { act, renderHook } from '@testing-library/react-native'
import { useShallow } from 'zustand/react/shallow'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { READER_LOCATION_PERSIST_KEY } from '../../lib/constants'
import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../reader-location-store'

function useReaderLocationSlice() {
  return useReaderLocationStore(
    useShallow((s) => ({
      book: s.book,
      chapter: s.chapter,
      versionId: s.versionId,
      setLocation: s.setLocation,
    })),
  )
}

async function resetReaderLocationStore() {
  mmkvStorage.clearAll()
  useReaderLocationStore.setState(readerLocationStoreInitialState)
  await useReaderLocationStore.persist.rehydrate()
}

describe('useReaderLocationStore', () => {
  beforeEach(() => {
    return resetReaderLocationStore()
  })

  it('returns null fields when MMKV is empty', () => {
    const { result } = renderHook(() => useReaderLocationSlice())

    expect(result.current.book).toBeNull()
    expect(result.current.chapter).toBeNull()
    expect(result.current.versionId).toBeNull()
  })

  it('persists book, chapter, and versionId across rerenders via MMKV', () => {
    const first = renderHook(() => useReaderLocationSlice())

    act(() => {
      first.result.current.setLocation({ book: 'GEN', chapter: '2', versionId: 59 })
    })

    expect(first.result.current.book).toBe('GEN')
    expect(first.result.current.chapter).toBe('2')
    expect(first.result.current.versionId).toBe(59)

    const second = renderHook(() => useReaderLocationSlice())
    expect(second.result.current.book).toBe('GEN')
    expect(second.result.current.chapter).toBe('2')
    expect(second.result.current.versionId).toBe(59)
  })

  it('rejects invalid values in setLocation', () => {
    const { result } = renderHook(() => useReaderLocationSlice())

    act(() => {
      result.current.setLocation({ book: '', chapter: 'abc', versionId: -1 })
    })

    expect(result.current.book).toBeNull()
    expect(result.current.chapter).toBeNull()
    expect(result.current.versionId).toBeNull()
  })

  it('rejects invalid stored values on rehydrate', async () => {
    mmkvStorage.set(
      READER_LOCATION_PERSIST_KEY,
      JSON.stringify({
        state: { book: '', chapter: 'abc', versionId: -1 },
        version: 0,
      }),
    )
    await useReaderLocationStore.persist.rehydrate()

    const { result } = renderHook(() => useReaderLocationSlice())
    expect(result.current.book).toBeNull()
    expect(result.current.chapter).toBeNull()
    expect(result.current.versionId).toBeNull()
  })

  it('normalizes numeric chapter strings on setLocation', () => {
    const { result } = renderHook(() => useReaderLocationSlice())

    act(() => {
      result.current.setLocation({ chapter: '12' })
    })

    expect(result.current.chapter).toBe('12')
  })
})
