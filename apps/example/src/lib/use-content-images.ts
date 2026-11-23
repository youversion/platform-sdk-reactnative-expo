import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useImages,
  useSearch,
  type YouVersionImage,
  type YouVersionImageSearchResults,
} from '@youversion/platform-react-native-expo-core'

import {
  appendUniqueIds,
  emptyCardList,
  imagesInServerOrder,
  reduceLibrary,
  unresolvedIds,
  type CardList,
} from './image-library'

const PAGE_SIZE = 30

export type ContentImages = {
  query: string
  setQuery: (query: string) => void
  submit: (raw: string) => void
  clear: () => void
  validation: string | null
  submittedQuery: string
  list: CardList<YouVersionImage>
  error: string | null
  loading: boolean
  loadMore: () => void
  retry: () => void
}

export function useContentImages(versionId: number, language: string): ContentImages {
  const imagesApi = useImages()
  const search = useSearch()
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [requestKey, setRequestKey] = useState(0)
  const [validation, setValidation] = useState<string | null>(null)
  const [list, setList] = useState<CardList<YouVersionImage>>(emptyCardList())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const generation = useRef(0)
  const loadingRef = useRef(false)
  const listRef = useRef(list)
  const submittedRef = useRef(submittedQuery)
  const versionRef = useRef(versionId)
  const orderedIds = useRef<readonly string[]>([])
  const resolved = useRef(new Map<string, YouVersionImage>())
  const pendingSearch = useRef<YouVersionImageSearchResults | null>(null)
  const imagesApiRef = useRef(imagesApi)
  const searchRef = useRef(search)
  const languageRef = useRef(language)

  listRef.current = list
  submittedRef.current = submittedQuery
  versionRef.current = versionId
  imagesApiRef.current = imagesApi
  searchRef.current = search
  languageRef.current = language

  const publish = useCallback((next: CardList<YouVersionImage>) => {
    listRef.current = next
    setList(next)
  }, [])

  const runRef = useRef<(replace: boolean) => Promise<void>>(async () => {})

  runRef.current = async (replace: boolean) => {
    const gen = generation.current
    const requestQuery = submittedRef.current
    const requestVersion = versionRef.current
    if (!replace && loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError(null)

    const finish = () => {
      if (gen !== generation.current) return
      loadingRef.current = false
      setLoading(false)
    }

    if (requestQuery === '') {
      const pageToken = replace ? null : listRef.current.nextPageToken
      const result = await imagesApiRef.current.list({
        language_ranges: [languageRef.current],
        page_size: PAGE_SIZE,
        page_token: pageToken,
      })
      if (gen !== generation.current) return
      if (!result.ok) {
        setError(result.error.message)
        finish()
        return
      }
      const base = replace ? emptyCardList<YouVersionImage>() : listRef.current
      publish(
        reduceLibrary(base, {
          type: replace ? 'replace' : 'append',
          page: result.value.data,
          nextPageToken: result.value.next_page_token,
        }),
      )
      finish()
      return
    }

    if (replace) {
      orderedIds.current = []
      resolved.current = new Map()
      pendingSearch.current = null
    }

    let searchPage = pendingSearch.current
    if (searchPage === null) {
      const token = replace ? null : listRef.current.nextPageToken
      const result = await searchRef.current.images({
        query: requestQuery,
        bibleId: requestVersion,
        pageSize: PAGE_SIZE,
        pageToken: token === null ? undefined : token,
      })
      if (gen !== generation.current) return
      if (submittedRef.current !== requestQuery || versionRef.current !== requestVersion) return
      if (!result.ok) {
        setError(result.error.message)
        finish()
        return
      }
      searchPage = result.value
      pendingSearch.current = searchPage
      orderedIds.current = appendUniqueIds(
        orderedIds.current,
        searchPage.images.map((hit) => hit.id),
      )
    }

    const pending = unresolvedIds(orderedIds.current, resolved.current)
    const loaded = await Promise.all(pending.map((id) => imagesApiRef.current.get(id)))
    if (gen !== generation.current) return
    if (submittedRef.current !== requestQuery || versionRef.current !== requestVersion) return

    // A hit the index still lists but `get` can't find would fail every retry, so drop it.
    let failure: string | null = null
    const missing = new Set<string>()
    for (let index = 0; index < pending.length; index += 1) {
      const id = pending[index]
      const result = loaded[index]
      if (id === undefined || result === undefined) continue
      if (result.ok) resolved.current.set(id, result.value)
      else if (result.error.kind === 'not-found') missing.add(id)
      else if (failure === null) failure = result.error.message
    }
    if (missing.size > 0) orderedIds.current = orderedIds.current.filter((id) => !missing.has(id))

    const items = imagesInServerOrder(orderedIds.current, resolved.current)
    if (failure !== null) {
      publish(
        reduceLibrary(listRef.current, {
          type: 'replace',
          page: items,
          nextPageToken: listRef.current.nextPageToken,
        }),
      )
      setError(failure)
      finish()
      return
    }

    const nextPageToken = searchPage.nextPageToken
    pendingSearch.current = null
    publish(
      reduceLibrary(listRef.current, {
        type: 'replace',
        page: items,
        nextPageToken,
      }),
    )
    finish()
  }

  useEffect(() => {
    generation.current += 1
    orderedIds.current = []
    resolved.current = new Map()
    pendingSearch.current = null
    const cleared = emptyCardList<YouVersionImage>()
    listRef.current = cleared
    setList(cleared)
    setError(null)
    void runRef.current(true)
    return () => {
      generation.current += 1
    }
  }, [submittedQuery, versionId, language, requestKey])

  const submit = useCallback((raw: string) => {
    const trimmed = raw.trim()
    if (trimmed.length > 100) {
      setValidation('Enter a search of 100 characters or fewer.')
      return
    }
    setValidation(null)
    setSubmittedQuery(trimmed)
    setRequestKey((key) => key + 1)
  }, [])

  const clear = useCallback(() => {
    setQuery('')
    setValidation(null)
    setSubmittedQuery('')
    setRequestKey((key) => key + 1)
  }, [])

  const loadMore = useCallback(() => {
    void runRef.current(false)
  }, [])

  const retry = useCallback(() => {
    const replace = listRef.current.items.length === 0 && pendingSearch.current === null
    void runRef.current(replace)
  }, [])

  return {
    query,
    setQuery,
    submit,
    clear,
    validation,
    submittedQuery,
    list,
    error,
    loading,
    loadMore,
    retry,
  }
}
