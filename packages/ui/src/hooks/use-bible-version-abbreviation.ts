import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useCallback, useEffect, useRef, useState } from 'react'

import { versionMetaFromBody, type VersionMeta } from '../lib/bible-version-abbreviation'

export type VersionLookupError = 'offline' | 'failed'

export type BibleVersionAbbreviation = {
  abbreviation: string | null
  languageId: string | null
  isLoading: boolean
  /** Set when this version's lookup failed. A settled empty name is not a failure. */
  error: VersionLookupError | null
  retry: () => void
}

const EMPTY_META: VersionMeta = { abbreviation: null, languageId: null }

/** The version each short name belongs to, so a settled miss cannot keep the last one's. */
type OwnedMeta = {
  versionId: number
  value: VersionMeta
}

/** Loads the short version name and language for the toolbar. */
export function useBibleVersionAbbreviation(
  versionId: number,
  options?: { enabled?: boolean },
): BibleVersionAbbreviation {
  const enabled = options?.enabled ?? true
  const { fetchBibleContent } = useYouVersion()
  const cacheRef = useRef(new Map<number, VersionMeta>())
  const generationRef = useRef(new Map<number, number>())
  const [versionIdForState, setVersionIdForState] = useState(versionId)
  // One version's short name and language move together: a mix of two versions would hand the
  // consumer this version's name with the last one's language.
  const [meta, setMeta] = useState<OwnedMeta | null>(null)
  const [settled, setSettled] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [errorOwned, setErrorOwned] = useState<{
    versionId: number
    error: VersionLookupError
  } | null>(null)
  const retry = useCallback(() => {
    setErrorOwned(null)
    setSettled(false)
    setAttempt((n) => n + 1)
  }, [])

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

  useEffect(() => {
    if (!enabled) {
      return
    }
    const cached = cacheRef.current.get(versionId)
    if (cached !== undefined) {
      setMeta({ versionId, value: cached })
      setSettled(true)
      setErrorOwned(null)
      return
    }

    let cancelled = false
    const generation = (generationRef.current.get(versionId) ?? 0) + 1
    generationRef.current.set(versionId, generation)
    setSettled(false)

    void fetchBibleContent({
      path: `/v1/bibles/${versionId}`,
    })
      .then((response) => {
        if (cancelled) {
          return
        }
        if (response.status !== 200) {
          setErrorOwned({ versionId, error: 'failed' })
          return
        }
        const next = versionMetaFromBody(response.body)
        if (generationRef.current.get(versionId) === generation) {
          cacheRef.current.set(versionId, next)
        }
        setMeta({ versionId, value: next })
        setErrorOwned(null)
      })
      .catch(() => {
        if (cancelled) {
          return
        }
        // Leave `meta` on the version it came from. `isStale` then drops it, so a
        // failed lookup cannot keep the previous version's name or language.
        setErrorOwned({ versionId, error: 'offline' })
      })
      .finally(() => {
        if (!cancelled) {
          setSettled(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [attempt, enabled, fetchBibleContent, versionId])

  const isLoading = enabled && !settled
  // The last short name can stay on the return while `isLoading` is true. The toolbar
  // covers it with a spinner.
  const isStale = meta === null || (meta.versionId !== versionId && !isLoading)
  const error =
    errorOwned !== null && errorOwned.versionId === versionId && !isLoading ? errorOwned.error : null
  return { ...(isStale ? EMPTY_META : meta.value), isLoading, error, retry }
}
