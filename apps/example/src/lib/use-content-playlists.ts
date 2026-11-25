import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlaylists } from '@youversion/platform-react-native-expo-core'

import { acceptIfCurrent, emptyCardList, reduceLibrary, type CardList } from './image-library'
import { collectionsOrSample } from './sample-video-library'
import { listedCollection, type ListedCollection } from './playlist-videos'

/** Bible Project organization from the Swift sample's video library. */
export const BIBLE_PROJECT_ORGANIZATION_ID = '6a4552c4-96eb-4df9-aa89-b2cae8db310d'

const PAGE_SIZE = 20

export type ContentPlaylists = {
  list: CardList<ListedCollection>
  error: string | null
  loading: boolean
  loadMore: () => void
  retry: () => void
}

export function useContentPlaylists(language: string): ContentPlaylists {
  const playlistsApi = usePlaylists()
  const [requestKey, setRequestKey] = useState(0)
  const [list, setList] = useState<CardList<ListedCollection>>(emptyCardList())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const generation = useRef(0)
  const loadingRef = useRef(false)
  const listRef = useRef(list)
  const apiRef = useRef(playlistsApi)
  const languageRef = useRef(language)

  listRef.current = list
  apiRef.current = playlistsApi
  languageRef.current = language

  const publish = useCallback((next: CardList<ListedCollection>) => {
    listRef.current = next
    setList(next)
  }, [])

  const runRef = useRef<(replace: boolean) => Promise<void>>(async () => {})

  runRef.current = async (replace: boolean) => {
    const gen = generation.current
    const pageToken = replace ? null : listRef.current.nextPageToken
    if (!replace && pageToken === null) return
    if (!replace && loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError(null)

    const finish = () => {
      if (acceptIfCurrent(gen, generation.current, true) === null) return
      loadingRef.current = false
      setLoading(false)
    }

    const result = await apiRef.current.list(BIBLE_PROJECT_ORGANIZATION_ID, {
      pageSize: PAGE_SIZE,
      pageToken,
      acceptLanguage: languageRef.current,
    })
    if (acceptIfCurrent(gen, generation.current, true) === null) return
    if (!result.ok) {
      setError(result.error.message)
      finish()
      return
    }

    const page = result.value.data.flatMap((playlist) => {
      const listed = listedCollection(playlist)
      if (listed === null) return []
      return [listed]
    })
    let nextPageToken = result.value.next_page_token
    if (nextPageToken !== null && nextPageToken === pageToken) nextPageToken = null
    const seeded = replace ? collectionsOrSample(page) : page
    const base = replace ? emptyCardList<ListedCollection>() : listRef.current
    publish(
      reduceLibrary(base, {
        type: replace ? 'replace' : 'append',
        page: [...seeded],
        nextPageToken,
      }),
    )
    finish()
  }

  useEffect(() => {
    generation.current += 1
    const cleared = emptyCardList<ListedCollection>()
    listRef.current = cleared
    setList(cleared)
    setError(null)
    void runRef.current(true)
    return () => {
      generation.current += 1
    }
  }, [language, requestKey])

  const loadMore = useCallback(() => {
    void runRef.current(false)
  }, [])

  const retry = useCallback(() => {
    if (listRef.current.items.length === 0) {
      setRequestKey((key) => key + 1)
      return
    }
    void runRef.current(false)
  }, [])

  return { list, error, loading, loadMore, retry }
}
