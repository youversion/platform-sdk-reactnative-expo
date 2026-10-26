import {
  clampSearchText,
  parseSearchLanguageRange,
  type SearchUnifiedOptions,
} from '@youversion/platform-core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useYouVersion } from '../use-youversion'
import { catchAsResult, createSearchClient } from './api'
import type {
  SearchApiError,
  YouVersionUnifiedSearchField,
  YouVersionUnifiedSearchResults,
} from './types'

export type UseUnifiedSearchProps = Readonly<{
  query: string
  bibleId: number
  languageRanges: string | readonly string[]
  userIntent?: SearchUnifiedOptions['userIntent']
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
  data: YouVersionUnifiedSearchResults | null
  error: SearchApiError | null
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

function searchOptions(props: UseUnifiedSearchProps): SearchUnifiedOptions {
  let options: SearchUnifiedOptions = {}
  if (props.fields !== undefined) {
    options = { ...options, fields: props.fields }
  }
  if (props.userIntent !== undefined) {
    options = { ...options, userIntent: props.userIntent }
  }
  return options
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
    () => createSearchClient({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )
  const active = run && options?.enabled !== false && isInputReady(props)
  const keepPreviousData = options?.keepPreviousData !== false
  const key = inputKey(props)
  const propsRef = useRef(props)
  propsRef.current = props
  const [settled, setSettled] = useState<SettledSearch | null>(null)
  const [refetchingError, setRefetchingError] = useState(false)
  const [generation, setGeneration] = useState(0)
  const settledRef = useRef(settled)
  settledRef.current = settled
  const activeRef = useRef(active)
  activeRef.current = active
  const keyRef = useRef(key)
  keyRef.current = key

  const refetch = useCallback(() => {
    if (!activeRef.current) {
      return
    }
    const current = settledRef.current
    if (current?.error && current.key === keyRef.current) {
      setRefetchingError(true)
    }
    setGeneration((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!active) {
      return
    }
    const current = propsRef.current
    const requestedKey = key
    let cancelled = false
    void catchAsResult(() =>
      client.searchUnified(
        current.query,
        current.bibleId,
        current.languageRanges,
        searchOptions(current),
      ),
    ).then((result) => {
      if (cancelled) {
        return
      }
      setRefetchingError(false)
      if (result.ok) {
        setSettled({ key: requestedKey, data: result.value, error: null })
        return
      }
      setSettled((previous) => ({
        key: requestedKey,
        data: previous?.key === requestedKey ? previous.data : null,
        error: result.error,
      }))
    })
    return () => {
      cancelled = true
    }
  }, [active, client, generation, key])

  if (!active) {
    return { data: null, loading: false, error: null, refetch }
  }

  const keyMatches = settled?.key === key
  const previousData = keepPreviousData ? (settled?.data ?? null) : null
  return {
    data: keyMatches ? (settled?.data ?? null) : previousData,
    loading: !keyMatches || (Boolean(settled?.error) && refetchingError),
    error: keyMatches ? (settled?.error ?? null) : null,
    refetch,
  }
}
