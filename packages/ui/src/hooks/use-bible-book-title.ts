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

/** Loads the version's book list once, then looks up the selected book's name and chapters.
 * Cache, settle, and retryKey match `useBibleVersionAbbreviation`. */
export function useBibleBookTitle(
  versionId: number,
  book: string,
  options?: { enabled?: boolean; retryKey?: number },
): BibleBookTitle {
  const enabled = options?.enabled ?? true
  const retryKey = options?.retryKey ?? 0
  const { fetchBibleContent } = useYouVersion()
  const cacheRef = useRef(new Map<number, Catalog>())
  const [versionIdForState, setVersionIdForState] = useState(versionId)
  const [retryKeyForState, setRetryKeyForState] = useState(retryKey)
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

  if (retryKeyForState !== retryKey) {
    setRetryKeyForState(retryKey)
    if (cacheRef.current.get(versionId) === undefined) {
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
          setOwned({ versionId, value: next })
        }
      })
      .catch(() => {
        // The miss is reported by leaving `owned` on the version it came from, which `isStale`
        // below then drops. Painting the last version's book name would misname this one.
      })
      .finally(() => {
        if (!cancelled) {
          setSettled(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled, fetchBibleContent, retryKey, versionId])

  const isLoading = enabled && !settled
  // While the new version loads, its predecessor's catalog still drives chevron
  // enablement. The chapter button shows a spinner, not that title. Once the
  // lookup settles without a catalog, both are gone: a wrong book name is worse
  // than none. A failed lookup stays empty until `retryKey` bumps.
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
