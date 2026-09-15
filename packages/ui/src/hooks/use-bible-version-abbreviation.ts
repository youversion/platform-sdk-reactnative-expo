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

    void fetchBibleContent({ path: `/v1/bibles/${versionId}` })
      .then((response) => {
        if (response.status !== 200) {
          return
        }
        const next = versionMetaFromBody(response.body)
        if (next.abbreviation === null && next.languageId === null) {
          return
        }
        cacheRef.current.set(versionId, next)
        if (!cancelled) {
          setMeta({ versionId, value: next })
        }
      })
      .catch(() => {
        // The miss is reported by leaving `meta` on the version it came from, which `isStale`
        // below then drops. Painting the last version's short name would misname this one.
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
  // While the new version loads, its predecessor's short name is what the spinner
  // covers. Once the lookup settles without one, it is gone: a wrong name is
  // worse than none. A failed lookup stays empty until `retryKey` bumps.
  const isStale = meta === null || (meta.versionId !== versionId && !isLoading)
  return { ...(isStale ? EMPTY_META : meta.value), isLoading }
}
