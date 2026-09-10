import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useRef, useState } from 'react'

import { catalogFromBooksBody, entryFromBooksCatalog, type BookCatalogEntry } from '../lib/bible-book-title'

export type BibleBookTitle = {
  title: string | null
  chapterCount: number | null
  isLoading: boolean
  catalog: ReadonlyMap<string, BookCatalogEntry> | null
}

type Catalog = ReadonlyMap<string, BookCatalogEntry>

/** Loads the version's book list once, then looks up the selected book's name and chapter count. */
export function useBibleBookTitle(
  versionId: number,
  book: string,
  options?: { enabled?: boolean },
): BibleBookTitle {
  const enabled = options?.enabled ?? true
  const { fetchBibleContent } = useYouVersion()
  const cacheRef = useRef(new Map<number, Catalog>())
  const [versionIdForState, setVersionIdForState] = useState(versionId)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [settled, setSettled] = useState(false)

  if (versionIdForState !== versionId) {
    setVersionIdForState(versionId)
    const cached = cacheRef.current.get(versionId)
    if (cached !== undefined) {
      setCatalog(cached)
      setSettled(true)
    } else {
      setSettled(false)
    }
  }

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false

    void fetchBibleContent({ path: `/v1/bibles/${versionId}/books` })
      .then((response) => {
        if (response.status !== 200) {
          return
        }
        const next = catalogFromBooksBody(response.body)
        if (next === null) {
          return
        }
        cacheRef.current.set(versionId, next)
        if (!cancelled) {
          setCatalog(next)
        }
      })
      .catch(() => {
        // Keep the last list on the button. A failed lookup is not worth a blank control.
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
    catalog,
  }
}
