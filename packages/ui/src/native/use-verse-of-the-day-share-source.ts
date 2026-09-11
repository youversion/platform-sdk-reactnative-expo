import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getVerseOfTheDayShareSource } from './verse-of-the-day-share'

type ShareSourceForPassage = {
  passageId: string
  versionId: number
  data: VerseOfTheDayShareData | null
}

export type VerseOfTheDayShareSource = {
  /** `null` while loading, on failure, and while the resolved passage does not match. */
  shareSource: VerseOfTheDayShareData | null
  /**
   * Fetches again for the current passage and returns the result. A share
   * press uses this as its retry path so a failed background fetch does not
   * leave share dead for the life of the mount.
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
  const { fetchBibleContent } = useYouVersion()
  const [result, setResult] = useState<ShareSourceForPassage | null>(null)
  // Latest requested passage, so a slow fetch for an old one cannot land on
  // top of a newer result. Cleared on unmount.
  const currentRef = useRef<{ versionId: number; passageId: string | null } | null>(null)

  useEffect(() => {
    currentRef.current = { versionId, passageId }
    return () => {
      currentRef.current = null
    }
  }, [versionId, passageId])

  const loadShareSource = useCallback(async () => {
    if (passageId == null) {
      return null
    }
    const data = await getVerseOfTheDayShareSource(fetchBibleContent, versionId, passageId)
    const current = currentRef.current
    if (current !== null && current.passageId === passageId && current.versionId === versionId) {
      setResult({ passageId, versionId, data })
    }
    return data
  }, [fetchBibleContent, versionId, passageId])

  useEffect(() => {
    void loadShareSource()
  }, [loadShareSource])

  const shareSource =
    result === null || result.passageId !== passageId || result.versionId !== versionId
      ? null
      : result.data
  return { shareSource, loadShareSource }
}
