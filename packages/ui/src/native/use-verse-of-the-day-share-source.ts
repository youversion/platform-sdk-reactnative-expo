import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { InternalVersionFilterProps } from '../lib/version-filter-props'
import { getVerseOfTheDayShareSource } from './verse-of-the-day-share'

type ShareSourceForPassage = {
  passageId: string
  versionId: number
  filters: InternalVersionFilterProps
  data: VerseOfTheDayShareData | null
}

type ShareRequest = {
  versionId: number
  passageId: string | null
  filters: InternalVersionFilterProps
}

function sameOptionalList<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) {
    return true
  }
  if (a === undefined || b === undefined) {
    return false
  }
  if (a.length !== b.length) {
    return false
  }
  return a.every((item, index) => item === b[index])
}

function sameFilters(a: InternalVersionFilterProps, b: InternalVersionFilterProps): boolean {
  return (
    sameOptionalList(a.permittedVersionIds, b.permittedVersionIds) &&
    sameOptionalList(a.excludedVersionIds, b.excludedVersionIds) &&
    sameOptionalList(a.permittedLanguageTags, b.permittedLanguageTags)
  )
}

function sameShareRequest(a: ShareRequest | null, b: ShareRequest): boolean {
  return (
    a !== null &&
    a.passageId === b.passageId &&
    a.versionId === b.versionId &&
    sameFilters(a.filters, b.filters)
  )
}

export type VerseOfTheDayShareSource = {
  /** `null` while loading, on failure, and while the resolved passage does not match. */
  shareSource: VerseOfTheDayShareData | null
  /**
   * Fetches again for the current passage and returns the result. A share
   * press uses this as its retry path so a failed background fetch does not
   * leave share dead for the life of the mount. Returns `null` when provider
   * filters change before the fetch settles.
   */
  loadShareSource: () => Promise<VerseOfTheDayShareData | null>
}

/**
 * Share payload for the pinned VOTD passage.
 *
 * Internal. Not on the UI or core package barrel.
 */
export function useVerseOfTheDayShareSource(
  versionId: number,
  passageId: string | null,
): VerseOfTheDayShareSource {
  const { fetchBibleContent, permittedVersionIds, excludedVersionIds, permittedLanguageTags } =
    useYouVersion()
  const [result, setResult] = useState<ShareSourceForPassage | null>(null)
  // Latest requested passage and filter lists, so a slow fetch cannot land on
  // top of a newer result. Cleared on unmount.
  const currentRef = useRef<ShareRequest | null>(null)

  useEffect(() => {
    currentRef.current = {
      versionId,
      passageId,
      filters: { permittedVersionIds, excludedVersionIds, permittedLanguageTags },
    }
    return () => {
      currentRef.current = null
    }
  }, [versionId, passageId, permittedVersionIds, excludedVersionIds, permittedLanguageTags])

  const loadShareSource = useCallback(async () => {
    if (passageId == null) {
      return null
    }
    const request: ShareRequest = {
      versionId,
      passageId,
      filters: { permittedVersionIds, excludedVersionIds, permittedLanguageTags },
    }
    const data = await getVerseOfTheDayShareSource(
      fetchBibleContent,
      versionId,
      passageId,
      request.filters,
    )
    if (!sameShareRequest(currentRef.current, request)) {
      return null
    }
    setResult({ passageId, versionId, filters: request.filters, data })
    return data
  }, [
    fetchBibleContent,
    versionId,
    passageId,
    permittedVersionIds,
    excludedVersionIds,
    permittedLanguageTags,
  ])

  useEffect(() => {
    void loadShareSource()
  }, [loadShareSource])

  const live: ShareRequest = {
    versionId,
    passageId,
    filters: { permittedVersionIds, excludedVersionIds, permittedLanguageTags },
  }
  const shareSource = result !== null && sameShareRequest(live, result) ? result.data : null
  return { shareSource, loadShareSource }
}
