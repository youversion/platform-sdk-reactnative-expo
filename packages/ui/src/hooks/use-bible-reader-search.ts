import {
  SEARCH_USER_INTENT,
  useSearch,
  type FetchBibleContent,
  type SearchApiError,
  type YouVersionSearchQuery,
  type YouVersionVerseSearchResult,
} from '@youversion/platform-react-native-expo-core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  clipSearchQuery,
  dedupeVerseUsfms,
  formatUsfmLabel,
  parsePassageSnippet,
  SEARCH_DEBOUNCE_MS,
  verseContentPath,
} from '../lib/bible-reader-search'

export type BibleReaderSearchVerseRow = {
  usfm: string
  title: string
  snippet: string | null
}

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
  suggestions: YouVersionSearchQuery[]
  verses: BibleReaderSearchVerseRow[]
  showingResults: boolean
  isLoadingSuggestions: boolean
  isLoadingSearch: boolean
  isLoadingPage: boolean
  searchError: SearchApiError | null
  pageError: SearchApiError | null
  hasNoResults: boolean
  scrollGeneration: number
  loadNextPage: () => void
  retrySearch: () => void
  retryPage: () => void
}

function toRows(verses: readonly YouVersionVerseSearchResult[]): BibleReaderSearchVerseRow[] {
  return verses.map((verse) => ({
    usfm: verse.reference,
    title: formatUsfmLabel(verse.reference),
    snippet: null,
  }))
}

/** A rejected call never reaches the Result type, so it needs an error of its own. */
const TRANSPORT_ERROR: SearchApiError = {
  kind: 'transient',
  message: 'Search request failed',
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

  const [query, setQueryState] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<YouVersionSearchQuery[]>([])
  const [verses, setVerses] = useState<BibleReaderSearchVerseRow[]>([])
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined)
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const [isLoadingSearch, setIsLoadingSearch] = useState(false)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [searchError, setSearchError] = useState<SearchApiError | null>(null)
  const [pageError, setPageError] = useState<SearchApiError | null>(null)
  const [scrollGeneration, setScrollGeneration] = useState(0)

  const suggestionIdRef = useRef(0)
  const searchIdRef = useRef(0)
  const pageIdRef = useRef(0)
  const enrichIdRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageInFlightRef = useRef(false)
  const submittedQueryRef = useRef<string | null>(null)
  const nextPageTokenRef = useRef<string | undefined>(undefined)
  const versesRef = useRef<BibleReaderSearchVerseRow[]>([])
  const wasOpenRef = useRef(false)

  versesRef.current = verses
  nextPageTokenRef.current = nextPageToken
  submittedQueryRef.current = submittedQuery

  const cancelDebounce = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }, [])

  const enrichRows = useCallback(
    async (usfms: readonly string[], requestId: number) => {
      const results = await Promise.all(
        usfms.map(async (usfm) => {
          try {
            const response = await fetchBibleContent({
              path: verseContentPath(versionId, usfm),
            })
            if (response.status !== 200) {
              return null
            }
            const parsed = parsePassageSnippet(response.body)
            if (parsed === null) {
              return null
            }
            return { usfm, title: parsed.title, snippet: parsed.snippet }
          } catch {
            return null
          }
        }),
      )
      if (requestId !== enrichIdRef.current) {
        return
      }
      setVerses((current) =>
        current.map((row) => {
          const match = results.find((result) => result !== null && result.usfm === row.usfm)
          if (match === undefined || match === null) {
            return row
          }
          return { ...row, title: match.title, snippet: match.snippet }
        }),
      )
    },
    [fetchBibleContent, versionId],
  )

  const loadTrending = useCallback(() => {
    cancelDebounce()
    const requestId = suggestionIdRef.current + 1
    suggestionIdRef.current = requestId
    setIsLoadingSuggestions(true)
    void search
      .trendingQueries({ languageRanges: ranges })
      .then((result) => {
        if (requestId !== suggestionIdRef.current) {
          return
        }
        setIsLoadingSuggestions(false)
        if (result.ok) {
          setSuggestions(result.value)
          return
        }
        setSuggestions([])
      })
      .catch(() => {
        // A rejection is a transport failure below the Result type. Clear the
        // spinner so the sheet does not sit on it forever.
        if (requestId !== suggestionIdRef.current) {
          return
        }
        setIsLoadingSuggestions(false)
        setSuggestions([])
      })
  }, [cancelDebounce, ranges, search])

  const loadSuggestions = useCallback(
    (text: string) => {
      const requestId = suggestionIdRef.current + 1
      suggestionIdRef.current = requestId
      setIsLoadingSuggestions(true)
      void search
        .suggestedQueries({ query: text, languageRanges: ranges })
        .then((result) => {
          if (requestId !== suggestionIdRef.current) {
            return
          }
          setIsLoadingSuggestions(false)
          if (result.ok) {
            setSuggestions(result.value)
            return
          }
          setSuggestions([])
        })
        .catch(() => {
          if (requestId !== suggestionIdRef.current) {
            return
          }
          setIsLoadingSuggestions(false)
          setSuggestions([])
        })
    },
    [ranges, search],
  )

  const runSearch = useCallback(
    (text: string) => {
      cancelDebounce()
      suggestionIdRef.current += 1
      const requestId = searchIdRef.current + 1
      searchIdRef.current = requestId
      pageIdRef.current += 1
      pageInFlightRef.current = false
      const enrichId = enrichIdRef.current + 1
      enrichIdRef.current = enrichId
      setSubmittedQuery(text)
      submittedQueryRef.current = text
      setSuggestions([])
      setVerses([])
      versesRef.current = []
      setNextPageToken(undefined)
      nextPageTokenRef.current = undefined
      setSearchError(null)
      setPageError(null)
      setIsLoadingPage(false)
      setIsLoadingSearch(true)
      void search
        .verses({
          query: text,
          bibleId: versionId,
          userIntent: SEARCH_USER_INTENT.unknown,
        })
        .then((result) => {
          if (requestId !== searchIdRef.current) {
            return
          }
          setIsLoadingSearch(false)
          if (!result.ok) {
            setSearchError(result.error)
            return
          }
          const rows = toRows(result.value.verses)
          setVerses(rows)
          versesRef.current = rows
          setNextPageToken(result.value.nextPageToken)
          nextPageTokenRef.current = result.value.nextPageToken
          void enrichRows(
            rows.map((row) => row.usfm),
            enrichId,
          )
        })
        .catch(() => {
          if (requestId !== searchIdRef.current) {
            return
          }
          setIsLoadingSearch(false)
          setSearchError(TRANSPORT_ERROR)
        })
    },
    [cancelDebounce, enrichRows, search, versionId],
  )

  const resetForOpen = useCallback(() => {
    cancelDebounce()
    suggestionIdRef.current += 1
    searchIdRef.current += 1
    pageIdRef.current += 1
    enrichIdRef.current += 1
    pageInFlightRef.current = false
    setQueryState('')
    setSubmittedQuery(null)
    submittedQueryRef.current = null
    setSuggestions([])
    setVerses([])
    versesRef.current = []
    setNextPageToken(undefined)
    nextPageTokenRef.current = undefined
    setIsLoadingSuggestions(false)
    setIsLoadingSearch(false)
    setIsLoadingPage(false)
    setSearchError(null)
    setPageError(null)
    setScrollGeneration((generation) => generation + 1)
    loadTrending()
  }, [cancelDebounce, loadTrending])

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      resetForOpen()
    }
    wasOpenRef.current = isOpen
  }, [isOpen, resetForOpen])

  useEffect(() => {
    return () => {
      cancelDebounce()
    }
  }, [cancelDebounce])

  const setQuery = useCallback(
    (text: string) => {
      const clipped = clipSearchQuery(text)
      setQueryState(clipped)
      const trimmed = clipped.trim()
      if (trimmed === '') {
        cancelDebounce()
        suggestionIdRef.current += 1
        searchIdRef.current += 1
        pageIdRef.current += 1
        enrichIdRef.current += 1
        pageInFlightRef.current = false
        setSubmittedQuery(null)
        submittedQueryRef.current = null
        setVerses([])
        versesRef.current = []
        setNextPageToken(undefined)
        nextPageTokenRef.current = undefined
        setSearchError(null)
        setPageError(null)
        setIsLoadingSearch(false)
        setIsLoadingPage(false)
        loadTrending()
        return
      }
      if (trimmed === submittedQueryRef.current) {
        cancelDebounce()
        return
      }
      searchIdRef.current += 1
      pageIdRef.current += 1
      enrichIdRef.current += 1
      pageInFlightRef.current = false
      setVerses([])
      versesRef.current = []
      setNextPageToken(undefined)
      nextPageTokenRef.current = undefined
      setSearchError(null)
      setPageError(null)
      setIsLoadingSearch(false)
      setIsLoadingPage(false)
      cancelDebounce()
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        loadSuggestions(trimmed)
      }, SEARCH_DEBOUNCE_MS)
    },
    [cancelDebounce, loadSuggestions, loadTrending],
  )

  const submit = useCallback(
    (text: string) => {
      const trimmed = clipSearchQuery(text).trim()
      setQueryState(trimmed)
      if (trimmed === '') {
        setQuery('')
        return
      }
      runSearch(trimmed)
    },
    [runSearch, setQuery],
  )

  const loadNextPage = useCallback(() => {
    const token = nextPageTokenRef.current
    const submitted = submittedQueryRef.current
    if (token === undefined || submitted === null) {
      return
    }
    if (pageInFlightRef.current) {
      return
    }
    pageInFlightRef.current = true
    const requestId = pageIdRef.current + 1
    pageIdRef.current = requestId
    const enrichId = enrichIdRef.current
    setIsLoadingPage(true)
    setPageError(null)
    void search
      .verses({
        query: submitted,
        bibleId: versionId,
        userIntent: SEARCH_USER_INTENT.unknown,
        pageToken: token,
      })
      .then((result) => {
        if (requestId !== pageIdRef.current) {
          return
        }
        pageInFlightRef.current = false
        setIsLoadingPage(false)
        if (!result.ok) {
          setPageError(result.error)
          return
        }
        const existingUsfms = versesRef.current.map((row) => row.usfm)
        const incomingUsfms = result.value.verses.map((verse) => verse.reference)
        const addedUsfms = dedupeVerseUsfms(existingUsfms, incomingUsfms)
        const addedRows = toRows(
          result.value.verses.filter((verse) => addedUsfms.includes(verse.reference)),
        )
        const nextRows = [...versesRef.current, ...addedRows]
        setVerses(nextRows)
        versesRef.current = nextRows
        setNextPageToken(result.value.nextPageToken)
        nextPageTokenRef.current = result.value.nextPageToken
        void enrichRows(addedUsfms, enrichId)
      })
      .catch(() => {
        if (requestId !== pageIdRef.current) {
          return
        }
        pageInFlightRef.current = false
        setIsLoadingPage(false)
        setPageError(TRANSPORT_ERROR)
      })
  }, [enrichRows, search, versionId])

  const retrySearch = useCallback(() => {
    const submitted = submittedQueryRef.current
    if (submitted === null) {
      return
    }
    runSearch(submitted)
  }, [runSearch])

  const retryPage = useCallback(() => {
    pageInFlightRef.current = false
    loadNextPage()
  }, [loadNextPage])

  const showingResults = submittedQuery !== null && query.trim() === submittedQuery
  const hasNoResults =
    showingResults && !isLoadingSearch && searchError === null && verses.length === 0

  return {
    query,
    setQuery,
    submit,
    suggestions,
    verses,
    showingResults,
    isLoadingSuggestions,
    isLoadingSearch,
    isLoadingPage,
    searchError,
    pageError,
    hasNoResults,
    scrollGeneration,
    loadNextPage,
    retrySearch,
    retryPage,
  }
}
