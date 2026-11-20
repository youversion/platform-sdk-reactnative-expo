import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState } from 'react'

import { bookTitlesFromBody } from './passage-label'

const EMPTY_TITLES: ReadonlyMap<string, string> = new Map()

export function useBookTitles(versionId: number): ReadonlyMap<string, string> {
  const { fetchBibleContent } = useYouVersion()
  const [titles, setTitles] = useState<ReadonlyMap<string, string>>(EMPTY_TITLES)
  const [loadedVersionId, setLoadedVersionId] = useState<number | null>(null)

  useEffect(() => {
    let current = true
    void fetchBibleContent({ path: `/v1/bibles/${versionId}/books` })
      .then((response) => {
        if (!current) return
        setLoadedVersionId(versionId)
        if (response.status !== 200) {
          setTitles(EMPTY_TITLES)
          return
        }
        setTitles(bookTitlesFromBody(response.body))
      })
      .catch(() => {
        if (!current) return
        setLoadedVersionId(versionId)
        setTitles(EMPTY_TITLES)
      })
    return () => {
      current = false
    }
  }, [fetchBibleContent, versionId])

  if (loadedVersionId !== versionId) return EMPTY_TITLES
  return titles
}
