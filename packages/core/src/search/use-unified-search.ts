import { clampSearchText, parseSearchLanguageRange } from '@youversion/platform-core'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createApiClient } from '../api-client'
// YPE-6577: swap this for `SearchClient.searchUnified` when platform-sdk-react#488 ships.
import {
  searchUnified,
  type ContentLibrarySearchOptions,
} from '../content-library/interim/search-unified'
import { useYouVersion } from '../use-youversion'
import { catchAsResult } from './api'
import type {
  SearchApiError,
  YouVersionUnifiedSearchField,
  YouVersionUnifiedSearchResults,
} from './types'

export type UseUnifiedSearchProps = Readonly<{
  query: string
  bibleId: number
  languageRanges: string | readonly string[]
  userIntent?: ContentLibrarySearchOptions['userIntent']
  fields?: readonly YouVersionUnifiedSearchField[]
}>

export type UseUnifiedSearchOptions = {
  enabled?: boolean
  keepPreviousData?: boolean
}

export type UseUnifiedSearchResult = {
  data: YouVersionUnifiedSearchResults | null
  loading: boolean
  error: SearchApiError | null
  refetch: () => void
}

type SettledSearch = {
  key: string
  clientKey: string
  generation: number
  data: YouVersionUnifiedSearchResults | null
  error: SearchApiError | null
}

function clientKey(appKey: string, apiHost: string, installationId: string): string {
  return JSON.stringify([appKey, apiHost, installationId])
}

function isInputReady(props: UseUnifiedSearchProps): boolean {
  const trimmed = props.query.trim()
  if (trimmed.length === 0 || clampSearchText(trimmed) !== trimmed) {
    return false
  }
  const ranges = Array.isArray(props.languageRanges) ? props.languageRanges : [props.languageRanges]
  if (ranges.length === 0) {
    return false
  }
  try {
    for (const range of ranges) {
      parseSearchLanguageRange(range)
    }
  } catch {
    return false
  }
  if (props.fields !== undefined && props.fields.length === 0) {
    return false
  }
  return true
}

function inputKey(props: UseUnifiedSearchProps): string {
  const ranges = Array.isArray(props.languageRanges) ? [...props.languageRanges] : [props.languageRanges]
  return JSON.stringify([
    props.query,
    props.bibleId,
    ranges,
    props.userIntent ?? null,
    props.fields ?? null,
  ])
}

function searchOptions(props: UseUnifiedSearchProps): ContentLibrarySearchOptions {
  if (props.fields !== undefined && props.userIntent !== undefined) {
    return { fields: props.fields, userIntent: props.userIntent }
  }
  if (props.fields !== undefined) {
    return { fields: props.fields }
  }
  if (props.userIntent !== undefined) {
    return { userIntent: props.userIntent }
  }
  return {}
}

export function useUnifiedSearch(
  props: UseUnifiedSearchProps,
  options?: UseUnifiedSearchOptions,
): UseUnifiedSearchResult {
  const context = useYouVersion()
  const override = context.hookOverrides?.useUnifiedSearch
  const live = useLiveUnifiedSearch(props, options, override == null)
  if (override) {
    return override(props, options)
  }
  return live
}

function useLiveUnifiedSearch(
  props: UseUnifiedSearchProps,
  options: UseUnifiedSearchOptions | undefined,
  run: boolean,
): UseUnifiedSearchResult {
  const { appKey, apiHost, installationId } = useYouVersion()
  const client = useMemo(
    () => createApiClient({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )
  const active = run && options?.enabled !== false && isInputReady(props)
  const keepPreviousData = options?.keepPreviousData !== false
  const key = inputKey(props)
  const scope = clientKey(appKey, apiHost, installationId)
  // The caller passes a new props object on every render. Keep the object from
  // the render where the search inputs changed, so a fresh object with the same
  // search does not start another request.
  const [request, setRequest] = useState(props)
  if (inputKey(request) !== key) {
    setRequest(props)
  }
  const [settled, setSettled] = useState<SettledSearch | null>(null)
  const [generation, setGeneration] = useState(0)

  const refetch = useCallback(() => {
    if (!active) {
      return
    }
    setGeneration((value) => value + 1)
  }, [active])

  useEffect(() => {
    if (!active) {
      return
    }
    const requestedKey = key
    const requestedScope = scope
    const requestedGeneration = generation
    let cancelled = false
    void catchAsResult(() =>
      searchUnified(
        client,
        request.query,
        request.bibleId,
        request.languageRanges,
        searchOptions(request),
      ),
    ).then((result) => {
      if (cancelled) {
        return
      }
      if (result.ok) {
        setSettled({
          key: requestedKey,
          clientKey: requestedScope,
          generation: requestedGeneration,
          data: result.value,
          error: null,
        })
        return
      }
      setSettled((previous) => ({
        key: requestedKey,
        clientKey: requestedScope,
        generation: requestedGeneration,
        data:
          previous?.key === requestedKey && previous.clientKey === requestedScope
            ? previous.data
            : null,
        error: result.error,
      }))
    })
    return () => {
      cancelled = true
    }
  }, [active, client, generation, key, request, scope])

  if (!active) {
    return { data: null, loading: false, error: null, refetch }
  }

  const sameClient = settled?.clientKey === scope
  const keyMatches = sameClient && settled.key === key
  let retryingError = false
  if (settled && keyMatches && settled.error && settled.generation !== generation) {
    retryingError = true
  }
  const previousData = keepPreviousData && sameClient ? settled.data : null
  return {
    data: keyMatches ? (settled?.data ?? null) : previousData,
    loading: !keyMatches || retryingError,
    error: keyMatches ? (settled?.error ?? null) : null,
    refetch,
  }
}
