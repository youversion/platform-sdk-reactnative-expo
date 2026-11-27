import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useRef, useState } from 'react'

import {
  catalogFromBooksBody,
  entryFromBooksCatalog,
  type BookCatalogEntry,
} from '../lib/bible-book-title'

export type BibleBookTitle = {
  title: string | null
  /** The selected book's catalog row, for chapter labels. */
  entry: BookCatalogEntry | null
  isLoading: boolean
  catalog: ReadonlyMap<string, BookCatalogEntry> | null
}

type Catalog = ReadonlyMap<string, BookCatalogEntry>

/** The version each book list belongs to, so next/previous cannot walk the last one's. */
type OwnedCatalog = {
  versionId: number
  value: Catalog
}

/** Loads the version's book list once, then looks up the selected book's name and chapters. */
export function useBibleBookTitle(
  versionId: number,
  book: string,
  options?: { enabled?: boolean },
): BibleBookTitle {
  const enabled = options?.enabled ?? true
  const { fetchBibleContent } = useYouVersion()
  const cacheRef = useRef(new Map<number, Catalog>())
  const generationRef = useRef(new Map<number, number>())
  const [versionIdForState, setVersionIdForState] = useState(versionId)
  const [owned, setOwned] = useState<OwnedCatalog | null>(null)
  const [settled, setSettled] = useState(false)

  if (versionIdForState !== versionId) {
    setVersionIdForState(versionId)
    const cached = cacheRef.current.get(versionId)
    if (cached !== undefined) {
      setOwned({ versionId, value: cached })
      setSettled(true)
    } else {
      setSettled(false)
    }
  }

  useEffect(() => {
    if (!enabled) {
      return
    }
    const cached = cacheRef.current.get(versionId)
    if (cached !== undefined) {
      setOwned({ versionId, value: cached })
      setSettled(true)
      return
    }

    let cancelled = false
    const generation = (generationRef.current.get(versionId) ?? 0) + 1
    generationRef.current.set(versionId, generation)

    const loadCatalog = async (): Promise<Catalog | null> => {
      // A transient failure can otherwise disable chapter navigation until remount.
      // Retry only this read, and only while the same version is active.
      for (let attempt = 0; attempt < 2 && !cancelled; attempt += 1) {
        try {
          const response = await fetchBibleContent({ path: `/v1/bibles/${versionId}/books` })
          if (response.status === 200) {
            return catalogFromBooksBody(response.body)
          }
          if (response.status !== 408 && (response.status < 500 || response.status >= 600)) {
            return null
          }
        } catch {
          // The native client also rejects on a transport error or timeout.
        }
      }
      return null
    }

    void loadCatalog()
      .then((next) => {
        if (next === null) {
          return
        }
        if (generationRef.current.get(versionId) === generation) {
          cacheRef.current.set(versionId, next)
        }
        if (!cancelled) {
          setOwned({ versionId, value: next })
        }
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

  const isLoading = enabled && !settled
  // Chevrons read `catalog`, which is this version's list only. The last title can
  // stay on `title` while `isLoading` is true. The toolbar covers it with a spinner.
  const isStale = owned === null || (owned.versionId !== versionId && !isLoading)
  const displayCatalog = isStale ? null : owned.value
  const entry = entryFromBooksCatalog(displayCatalog, book)
  const catalog = owned !== null && owned.versionId === versionId ? owned.value : null
  return {
    title: entry?.title ?? null,
    entry,
    isLoading,
    catalog,
  }
}
