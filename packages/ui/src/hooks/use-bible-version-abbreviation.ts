import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useRef, useState } from 'react'

import { versionMetaFromBody, type VersionMeta } from '../lib/bible-version-abbreviation'

export type BibleVersionAbbreviation = {
  abbreviation: string | null
  languageId: string | null
  isLoading: boolean
}

const EMPTY_META: VersionMeta = { abbreviation: null, languageId: null }

/** Loads the short version name and language for the toolbar. Falls back to nothing on a miss. */
export function useBibleVersionAbbreviation(
  versionId: number,
  options?: { enabled?: boolean },
): BibleVersionAbbreviation {
  const enabled = options?.enabled ?? true
  const { fetchBibleContent } = useYouVersion()
  const cacheRef = useRef(new Map<number, VersionMeta>())
  const [versionIdForState, setVersionIdForState] = useState(versionId)
  // One version's short name and language move together: a mix of two versions would hand the
  // consumer this version's name with the last one's language.
  const [meta, setMeta] = useState<VersionMeta>(EMPTY_META)
  const [settled, setSettled] = useState(false)

  if (versionIdForState !== versionId) {
    setVersionIdForState(versionId)
    const cached = cacheRef.current.get(versionId)
    if (cached !== undefined) {
      setMeta(cached)
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
          setMeta(next)
        }
      })
      .catch(() => {
        // Keep the last short name on the button. A failed lookup is not worth a blank control.
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

  return { ...meta, isLoading: enabled && !settled }
}
