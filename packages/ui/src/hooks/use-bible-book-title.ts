import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState } from 'react'

import { catalogFromBooksBody, entryFromBooksCatalog, type BookCatalogEntry } from '../lib/bible-book-title'

export type BibleBookTitle = {
  title: string | null
  chapterCount: number | null
  isLoading: boolean
}

/** Loads the version's book list once, then looks up the selected book's name and chapter count. */
export function useBibleBookTitle(
  versionId: number,
  book: string,
  options?: { enabled?: boolean },
): BibleBookTitle {
  const enabled = options?.enabled ?? true
  const { fetchBibleContent } = useYouVersion()
  const [versionIdForState, setVersionIdForState] = useState(versionId)
  const [catalog, setCatalog] = useState<ReadonlyMap<string, BookCatalogEntry> | null>(null)
  const [settled, setSettled] = useState(false)

  if (versionIdForState !== versionId) {
    setVersionIdForState(versionId)
    setCatalog(null)
    setSettled(false)
  }

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false

    void fetchBibleContent({ path: `/v1/bibles/${versionId}/books` })
      .then((response) => {
        if (cancelled || response.status !== 200) {
          return
        }
        const next = catalogFromBooksBody(response.body)
        if (next !== null) {
          setCatalog(next)
        }
      })
      .catch(() => {
        // Keep the chapter number on the button. A failed lookup is not worth a blank control.
      })
      .finally(() => {
        if (!cancelled) {
          setSettled(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled, fetchBibleContent, versionId])

  const entry = entryFromBooksCatalog(catalog, book)
  return {
    title: entry?.title ?? null,
    chapterCount: entry?.chapterCount ?? null,
    isLoading: enabled && !settled,
  }
}
