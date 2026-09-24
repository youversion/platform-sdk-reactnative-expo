import { act, renderHook } from '@testing-library/react-native'
import { useShallow } from 'zustand/react/shallow'

import { mmkvStorage } from '@youversion/platform-react-native-expo-core'
import { nonBlankQuery, type NonBlankQuery } from '../../lib/bible-reader-search'
import { SEARCH_HISTORY_MAX, SEARCH_HISTORY_PERSIST_KEY } from '../../lib/constants'
import { searchHistoryStoreInitialState, useSearchHistoryStore } from '../search-history-store'

function query(text: string): NonBlankQuery {
  const branded = nonBlankQuery(text)
  if (branded === null) {
    throw new Error(`test fixture query is blank: ${text}`)
  }
  return branded
}

function useSearchHistorySlice() {
  return useSearchHistoryStore(
    useShallow((state) => ({ entries: state.entries, record: state.record })),
  )
}

async function resetSearchHistoryStore() {
  mmkvStorage.clearAll()
  useSearchHistoryStore.setState(searchHistoryStoreInitialState)
  await useSearchHistoryStore.persist.rehydrate()
}

describe('useSearchHistoryStore', () => {
  beforeEach(() => {
    return resetSearchHistoryStore()
  })

  it('starts empty when MMKV is empty', () => {
    const { result } = renderHook(() => useSearchHistorySlice())

    expect(result.current.entries).toEqual([])
  })

  it('records newest first and persists across rerenders via MMKV', () => {
    const first = renderHook(() => useSearchHistorySlice())

    act(() => {
      first.result.current.record(query('faith'))
      first.result.current.record(query('hope'))
    })

    expect(first.result.current.entries).toEqual(['hope', 'faith'])

    const second = renderHook(() => useSearchHistorySlice())
    expect(second.result.current.entries).toEqual(['hope', 'faith'])
  })

  it('moves an existing query to the front regardless of case', () => {
    const { result } = renderHook(() => useSearchHistorySlice())

    act(() => {
      result.current.record(query('faith'))
      result.current.record(query('hope'))
      result.current.record(query('FAITH'))
    })

    expect(result.current.entries).toEqual(['FAITH', 'hope'])
  })

  it('caps the history at eight entries', () => {
    const { result } = renderHook(() => useSearchHistorySlice())

    act(() => {
      for (let index = 0; index < SEARCH_HISTORY_MAX + 3; index += 1) {
        result.current.record(query(`query-${index}`))
      }
    })

    expect(result.current.entries).toHaveLength(SEARCH_HISTORY_MAX)
    expect(result.current.entries[0]).toBe('query-10')
    expect(result.current.entries[SEARCH_HISTORY_MAX - 1]).toBe('query-3')
  })

  it('drops unparseable stored entries on rehydrate', async () => {
    mmkvStorage.set(
      SEARCH_HISTORY_PERSIST_KEY,
      JSON.stringify({ state: { entries: ['faith', '   ', 42, 'hope'] }, version: 0 }),
    )
    await useSearchHistoryStore.persist.rehydrate()

    const { result } = renderHook(() => useSearchHistorySlice())
    expect(result.current.entries).toEqual(['faith', 'hope'])
  })
})
