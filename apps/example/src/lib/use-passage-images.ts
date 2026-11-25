import { useCallback, useEffect, useRef, useState } from 'react'
import { useImages, type YouVersionImage } from '@youversion/platform-react-native-expo-core'

import {
  acceptIfCurrent,
  dedupeAppend,
  emptyCardList,
  reduceLibrary,
  type CardList,
} from './image-library'

const PAGE_SIZE = 99
const MAX_PAGES = 20

export type PassageImages = {
  list: CardList<YouVersionImage>
  error: string | null
  loading: boolean
  retry: () => void
}

export function usePassageImages(primary: YouVersionImage | null, language: string): PassageImages {
  const imagesApi = useImages()
  const [list, setList] = useState<CardList<YouVersionImage>>(emptyCardList())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const generation = useRef(0)
  const listRef = useRef(list)
  const imagesApiRef = useRef(imagesApi)
  const primaryRef = useRef(primary)
  const languageRef = useRef(language)

  listRef.current = list
  imagesApiRef.current = imagesApi
  primaryRef.current = primary
  languageRef.current = language

  const publish = useCallback((next: CardList<YouVersionImage>) => {
    listRef.current = next
    setList(next)
  }, [])

  useEffect(() => {
    const image = primaryRef.current
    if (image === null) {
      publish(emptyCardList())
      return
    }

    const gen = ++generation.current
    const alreadyShowing = listRef.current.items.some((item) => item.id === image.id)
    const starting = alreadyShowing
      ? listRef.current
      : reduceLibrary(emptyCardList<YouVersionImage>(), {
          type: 'replace',
          page: [image],
          nextPageToken: null,
        })
    if (!alreadyShowing) publish(starting)

    async function loadPages(
      requestGeneration: number,
      primaryImage: YouVersionImage,
      startingList: CardList<YouVersionImage>,
    ): Promise<void> {
      setLoading(true)
      setError(null)
      let working = startingList
      let token: string | null = null
      const seen = new Set<string>()
      let first = true
      let pages = 0

      while (acceptIfCurrent(requestGeneration, generation.current, true) !== null) {
        pages += 1
        if (pages > MAX_PAGES) {
          setError("Couldn't load more images.")
          setLoading(false)
          return
        }
        if (token !== null) {
          if (seen.has(token)) {
            setError("Couldn't load more images.")
            setLoading(false)
            return
          }
          seen.add(token)
        }

        const result = await imagesApiRef.current.list({
          passage_id: primaryImage.passage_id,
          language_ranges: [languageRef.current],
          page_size: PAGE_SIZE,
          page_token: token,
        })
        if (acceptIfCurrent(requestGeneration, generation.current, true) === null) return
        if (!result.ok) {
          setError(result.error.message)
          setLoading(false)
          return
        }

        const nextPageToken = result.value.next_page_token
        const page = first ? dedupeAppend([primaryImage], result.value.data) : result.value.data
        working = reduceLibrary(working, {
          type: first ? 'replace' : 'append',
          page,
          nextPageToken,
        })
        publish(working)
        first = false
        if (nextPageToken === null) {
          setError(null)
          setLoading(false)
          return
        }
        token = nextPageToken
      }
    }

    void loadPages(gen, image, starting)
    return () => {
      generation.current += 1
    }
  }, [primary, language, reloadKey, publish])

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [])

  return { list, error, loading, retry }
}
