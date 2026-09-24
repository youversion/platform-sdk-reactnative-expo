import {
  SEARCH_USER_INTENT,
  useSearch,
  type FetchBibleContent,
  type SearchApiError,
  type YouVersionSearchQuery,
} from '@youversion/platform-react-native-expo-core'
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'

import {
  dedupeVerseUsfms,
  nonBlankQuery,
  pageTokenOf,
  SEARCH_DEBOUNCE_MS,
  SEARCH_QUERY_MAX_LENGTH,
  titledVerseFromPassage,
  usfmsFromSearchHits,
  verseContentPath,
  type NonBlankQuery,
  type TitledVerse,
  type Usfm,
} from '../lib/bible-reader-search'
import {
  demandOf,
  ENRICHMENT_FAILED,
  fieldTextOf,
  initialSearchState,
  searchReducer,
  type SearchDemand,
  type SearchState,
} from '../lib/bible-reader-search-machine'
import { toSearchView, type SearchView } from '../lib/bible-reader-search-view'
import { useSearchHistoryStore } from '../stores/search-history-store'

export type UseBibleReaderSearchOptions = {
  versionId: number
  isOpen: boolean
  fetchBibleContent: FetchBibleContent
  languageRanges: readonly string[]
}

export type UseBibleReaderSearchResult = {
  query: string
  setQuery: (text: string) => void
  submit: (text: string) => void
  view: SearchView
  scrollGeneration: number
}

/** A rejected call never reaches the Result type, so it needs an error of its own. */
const TRANSPORT_ERROR: SearchApiError = {
  kind: 'transient',
  message: 'Search request failed',
}

const NO_DEMAND: SearchDemand = { kind: 'none' }

function clipField(text: string): string {
  if (text.length <= SEARCH_QUERY_MAX_LENGTH) {
    return text
  }
  return text.slice(0, SEARCH_QUERY_MAX_LENGTH)
}

function brandQueries(queries: readonly YouVersionSearchQuery[]): readonly NonBlankQuery[] {
  const branded: NonBlankQuery[] = []
  for (const item of queries) {
    const query = nonBlankQuery(item.text)
    if (query !== null) {
      branded.push(query)
    }
  }
  return branded
}

function demandSignature(demand: SearchDemand): string {
  switch (demand.kind) {
    case 'none':
      return 'none'
    case 'trending':
      return `trending:${demand.epoch}`
    case 'suggestions':
      return `suggestions:${demand.epoch}:${demand.query}:${demand.status}`
    case 'verses':
      return `verses:${demand.epoch}:${demand.query}`
    case 'page':
      return `page:${demand.epoch}:${demand.query}:${demand.token}`
  }
}

async function titledVersesFor(
  usfms: readonly Usfm[],
  versionId: number,
  fetchBibleContent: FetchBibleContent,
): Promise<readonly TitledVerse[]> {
  const results = await Promise.all(
    usfms.map(async (usfm) => {
      try {
        const response = await fetchBibleContent({
          path: verseContentPath(versionId, usfm),
        })
        if (response.status !== 200) {
          return null
        }
        return titledVerseFromPassage(usfm, response.body)
      } catch {
        return null
      }
    }),
  )
  return results.filter((verse): verse is TitledVerse => verse !== null)
}

function submittedOf(
  state: SearchState,
): NonBlankQuery | null {
  if (state.kind === 'searching' || state.kind === 'resolved' || state.kind === 'failed') {
    return state.submitted
  }
  return null
}

export function useBibleReaderSearch(
  options: UseBibleReaderSearchOptions,
): UseBibleReaderSearchResult {
  const { versionId, isOpen, fetchBibleContent, languageRanges } = options
  const search = useSearch()
  const languageRangeKey = languageRanges.join(',')
  const ranges = useMemo(() => {
    if (languageRangeKey === '') {
      return ['*']
    }
    return languageRangeKey.split(',')
  }, [languageRangeKey])

  const [state, dispatch] = useReducer(searchReducer, undefined, initialSearchState)
  const [scrollGeneration, setScrollGeneration] = useState(0)
  const [armed, setArmed] = useState(false)
  const recents = useSearchHistoryStore((history) => history.entries)
  const record = useSearchHistoryStore((history) => history.record)

  const wasOpenRef = useRef(false)
  const languageRangeKeyRef = useRef(languageRangeKey)
  const searchedVersionRef = useRef(versionId)
  const stateRef = useRef(state)
  stateRef.current = state

  const retrySearch = useCallback(() => {
    dispatch({ type: 'retried' })
  }, [])

  const loadNextPage = useCallback(() => {
    dispatch({ type: 'pageRequested' })
  }, [])

  const setQuery = useCallback((text: string) => {
    const clipped = clipField(text)
    const submitted = submittedOf(stateRef.current)
    // Match the raw field text. Trimming would treat "love " as the submitted
    // "love" and drop the space, so the next character lands on "loveo".
    if (submitted !== null && clipped === submitted) {
      return
    }
    dispatch({ type: 'queryEdited', text: clipped })
  }, [])

  const submit = useCallback((text: string) => {
    const clipped = clipField(text)
    const query = nonBlankQuery(clipped)
    if (query === null) {
      dispatch({ type: 'queryEdited', text: clipped })
      return
    }
    const current = stateRef.current
    if (
      current.kind === 'resolved' &&
      current.submitted === query &&
      searchedVersionRef.current === versionId
    ) {
      return
    }
    record(query)
    searchedVersionRef.current = versionId
    dispatch({ type: 'submitted', query })
  }, [record, versionId])

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      dispatch({ type: 'opened' })
      setScrollGeneration((generation) => generation + 1)
      setArmed(true)
    } else if (!isOpen) {
      setArmed(false)
    }
    wasOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    if (languageRangeKeyRef.current === languageRangeKey) {
      return
    }
    languageRangeKeyRef.current = languageRangeKey
    if (!isOpen) {
      return
    }
    dispatch({ type: 'languageChanged' })
  }, [isOpen, languageRangeKey])

  const demand = isOpen && armed ? demandOf(state) : NO_DEMAND
  const demandRef = useRef(demand)
  demandRef.current = demand
  const signature = demandSignature(demand)

  useEffect(() => {
    const current = demandRef.current
    if (current.kind === 'none') {
      return
    }

    let cancelled = false

    const loadTrending = async () => {
      if (current.kind !== 'trending') {
        return
      }
      try {
        const result = await search.trendingQueries({ languageRanges: ranges })
        if (cancelled) {
          return
        }
        if (!result.ok) {
          dispatch({ type: 'trendingLoaded', epoch: current.epoch, queries: [] })
          return
        }
        dispatch({
          type: 'trendingLoaded',
          epoch: current.epoch,
          queries: brandQueries(result.value.queries),
        })
      } catch {
        if (cancelled) {
          return
        }
        dispatch({ type: 'trendingLoaded', epoch: current.epoch, queries: [] })
      }
    }

    const loadSuggestions = async () => {
      if (current.kind !== 'suggestions') {
        return
      }
      try {
        const result = await search.suggestedQueries({
          query: current.query,
          languageRanges: ranges,
        })
        if (cancelled) {
          return
        }
        if (!result.ok) {
          dispatch({ type: 'suggestionsLoaded', epoch: current.epoch, queries: [] })
          return
        }
        dispatch({
          type: 'suggestionsLoaded',
          epoch: current.epoch,
          queries: brandQueries(result.value.queries),
        })
      } catch {
        if (cancelled) {
          return
        }
        dispatch({ type: 'suggestionsLoaded', epoch: current.epoch, queries: [] })
      }
    }

    const loadVerses = async () => {
      if (current.kind !== 'verses') {
        return
      }
      try {
        const result = await search.verses({
          query: current.query,
          bibleId: versionId,
          userIntent: SEARCH_USER_INTENT.unknown,
        })
        if (cancelled) {
          return
        }
        if (!result.ok) {
          dispatch({ type: 'searchFailed', epoch: current.epoch, error: result.error })
          return
        }
        const usfms = usfmsFromSearchHits(result.value.verses)
        const verses = await titledVersesFor(usfms, versionId, fetchBibleContent)
        if (cancelled) {
          return
        }
        dispatch({
          type: 'resultsCommitted',
          epoch: current.epoch,
          verses,
          seen: new Set(usfms),
          nextPageToken: pageTokenOf(result.value.nextPageToken),
        })
      } catch {
        if (cancelled) {
          return
        }
        dispatch({ type: 'searchFailed', epoch: current.epoch, error: TRANSPORT_ERROR })
      }
    }

    const loadPage = async () => {
      if (current.kind !== 'page') {
        return
      }
      try {
        const result = await search.verses({
          query: current.query,
          bibleId: versionId,
          userIntent: SEARCH_USER_INTENT.unknown,
          pageToken: current.token,
        })
        if (cancelled) {
          return
        }
        if (!result.ok) {
          dispatch({ type: 'pageFailed', epoch: current.epoch, error: result.error })
          return
        }
        const incoming = usfmsFromSearchHits(result.value.verses)
        const added = dedupeVerseUsfms(current.seen, incoming)
        const verses = await titledVersesFor(added, versionId, fetchBibleContent)
        if (cancelled) {
          return
        }
        if (added.length > 0 && verses.length === 0) {
          dispatch({ type: 'pageFailed', epoch: current.epoch, error: ENRICHMENT_FAILED })
          return
        }
        dispatch({
          type: 'pageCommitted',
          epoch: current.epoch,
          verses,
          seen: new Set(incoming),
          nextPageToken: pageTokenOf(result.value.nextPageToken),
        })
      } catch {
        if (cancelled) {
          return
        }
        dispatch({ type: 'pageFailed', epoch: current.epoch, error: TRANSPORT_ERROR })
      }
    }

    if (current.kind === 'suggestions' && current.status === 'scheduled') {
      const timer = setTimeout(() => {
        dispatch({ type: 'suggestionsStarted', epoch: current.epoch })
      }, SEARCH_DEBOUNCE_MS)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }

    if (current.kind === 'suggestions') {
      void loadSuggestions()
    } else if (current.kind === 'trending') {
      void loadTrending()
    } else if (current.kind === 'verses') {
      void loadVerses()
    } else if (current.kind === 'page') {
      void loadPage()
    }

    return () => {
      cancelled = true
    }
  }, [fetchBibleContent, ranges, search, signature, versionId])

  const view = toSearchView(state, recents, { retrySearch, loadNextPage })

  return {
    query: fieldTextOf(state),
    setQuery,
    submit,
    view,
    scrollGeneration,
  }
}
