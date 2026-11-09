import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { VerseOfTheDayShareData } from '@youversion/platform-react-ui'
import { useCallback, useEffect, useRef, useState } from 'react'

import { sameVersionFilters, type InternalVersionFilterProps } from '../lib/version-filter-props'
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

type InFlightShareLoad = {
  request: ShareRequest
  promise: Promise<VerseOfTheDayShareData | null>
}

function sameShareRequest(a: ShareRequest | null, b: ShareRequest): boolean {
  return (
    a !== null &&
    a.passageId === b.passageId &&
    a.versionId === b.versionId &&
    sameVersionFilters(a.filters, b.filters)
  )
}

export type VerseOfTheDayShareSource = {
  shareSource: VerseOfTheDayShareData | null
  loadShareSource: () => Promise<VerseOfTheDayShareData | null>
}

export function useVerseOfTheDayShareSource(
  versionId: number,
  passageId: string | null,
): VerseOfTheDayShareSource {
  const { fetchBibleContent, permittedVersionIds, excludedVersionIds, permittedLanguageTags } =
    useYouVersion()
  const [result, setResult] = useState<ShareSourceForPassage | null>(null)
  const currentRef = useRef<ShareRequest | null>(null)
  const inFlightRef = useRef<InFlightShareLoad | null>(null)

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
    const inFlight = inFlightRef.current
    if (inFlight !== null && sameShareRequest(inFlight.request, request)) {
      return inFlight.promise
    }
    const promise = (async () => {
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
    })()
    inFlightRef.current = { request, promise }
    try {
      return await promise
    } finally {
      if (inFlightRef.current?.promise === promise) {
        inFlightRef.current = null
      }
    }
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
