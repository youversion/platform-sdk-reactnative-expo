import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useRef, useState } from 'react'

import { versionMetaFromBody, type VersionMeta } from '../lib/bible-version-abbreviation'

export type BibleVersionAbbreviation = {
  abbreviation: string | null
  languageId: string | null
  isLoading: boolean
}

const EMPTY_META: VersionMeta = { abbreviation: null, languageId: null }

/** The version each short name belongs to, so a settled miss cannot keep the last one's. */
type OwnedMeta = {
  versionId: number
  value: VersionMeta
}

/** Loads the short version name and language for the toolbar. Falls back to nothing on a miss.
 * Cache, settle, and retryKey match `useBibleBookTitle`. */
export function useBibleVersionAbbreviation(
  versionId: number,
  options?: { enabled?: boolean; retryKey?: number },
): BibleVersionAbbreviation {
  const enabled = options?.enabled ?? true
  const retryKey = options?.retryKey ?? 0
  const { fetchBibleContent } = useYouVersion()
  const cacheRef = useRef(new Map<number, VersionMeta>())
  const generationRef = useRef(new Map<number, number>())
  const fetchedRetryKeyRef = useRef<number | null>(null)
  const [versionIdForState, setVersionIdForState] = useState(versionId)
  const [retryKeyForState, setRetryKeyForState] = useState(retryKey)
  // One version's short name and language move together: a mix of two versions would hand the
  // consumer this version's name with the last one's language.
  const [meta, setMeta] = useState<OwnedMeta | null>(null)
  const [settled, setSettled] = useState(false)

  if (versionIdForState !== versionId) {
    setVersionIdForState(versionId)
    const cached = cacheRef.current.get(versionId)
    if (cached !== undefined) {
      setMeta({ versionId, value: cached })
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
    const generation = (generationRef.current.get(versionId) ?? 0) + 1
    generationRef.current.set(versionId, generation)
    // Skip for every run of this retryKey, including Strict Mode remounts. Stamp
    // only after settle so a remount cannot reread the cached miss this retry is beating.
    const skipCache =
      fetchedRetryKeyRef.current !== null && fetchedRetryKeyRef.current !== retryKey

    void fetchBibleContent({
      path: `/v1/bibles/${versionId}`,
      skipCache,
    })
      .then((response) => {
        if (response.status !== 200) {
          return
        }
        const next = versionMetaFromBody(response.body)
        if (next.abbreviation === null && next.languageId === null) {
          return
        }
        if (generationRef.current.get(versionId) === generation) {
          cacheRef.current.set(versionId, next)
        }
        if (!cancelled) {
          setMeta({ versionId, value: next })
        }
      })
      .catch(() => {
        // The miss is reported by leaving `meta` on the version it came from, which `isStale`
        // below then drops. Painting the last version's short name would misname this one.
      })
      .finally(() => {
        fetchedRetryKeyRef.current = retryKey
        if (!cancelled) {
          setSettled(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled, fetchBibleContent, retryKey, versionId])

  const isLoading = enabled && !settled
  // The last short name can stay on the return while `isLoading` is true. The toolbar
  // covers it with a spinner. A failed lookup stays empty until `retryKey` bumps.
  const isStale = meta === null || (meta.versionId !== versionId && !isLoading)
  return { ...(isStale ? EMPTY_META : meta.value), isLoading }
}
