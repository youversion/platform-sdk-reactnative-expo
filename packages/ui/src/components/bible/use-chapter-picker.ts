import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import type { BibleChapterPickerSelectData } from '@youversion/platform-react-ui'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useLocale } from '../../i18n/locale-context'
import { catalogFromBooksBody } from '../../lib/bible-book-title'
import { versionMetaFromBody } from '../../lib/bible-version-abbreviation'
import type { InternalVersionFilterProps } from '../../lib/version-filter-props'
import { isUsableBibleVersion, isVersionIdDecidablyUnusable } from '../../lib/version-usability'
import {
  booksFromCatalog,
  visibleChapterPickerBooks,
  type ChapterPickerBook,
  type ChapterPickerOrder,
} from './chapter-picker-model'

export type ChapterPickerLoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; books: readonly ChapterPickerBook[] }

export type ChapterPickerController = {
  loadState: ChapterPickerLoadState
  visibleBooks: readonly ChapterPickerBook[]
  query: string
  order: ChapterPickerOrder
  expandedBookId: string | null
  pendingChapterId: string | null
  setQuery: (query: string) => void
  setOrder: (order: ChapterPickerOrder) => void
  setExpandedBookId: (bookId: string | null) => void
  retry: () => void
  selectChapter: (book: string, chapter: string) => Promise<boolean>
}

export function useChapterPicker({
  book,
  versionId,
  onSelect,
}: {
  book: string
  versionId: number
  onSelect?: (data: BibleChapterPickerSelectData) => void | Promise<void>
}): ChapterPickerController {
  const { fetchBibleContent, permittedVersionIds, excludedVersionIds, permittedLanguageTags } =
    useYouVersion()
  const { lng } = useLocale()
  const incomingFilters: InternalVersionFilterProps = {
    permittedVersionIds,
    excludedVersionIds,
    permittedLanguageTags,
  }
  const [filters, setFilters] = useState(incomingFilters)
  if (!sameVersionFilters(filters, incomingFilters)) {
    setFilters(incomingFilters)
  }
  const [loadState, setLoadState] = useState<ChapterPickerLoadState>({ status: 'loading' })
  const [query, setQuery] = useState('')
  const [order, setOrder] = useState<ChapterPickerOrder>('traditional')
  const [expandedBookId, setExpandedBookId] = useState<string | null>(book)
  const [pendingChapterId, setPendingChapterId] = useState<string | null>(null)
  const selectionPendingRef = useRef(false)
  const [requestGeneration, setRequestGeneration] = useState(0)

  useEffect(() => setExpandedBookId(book), [book])

  useEffect(() => {
    let cancelled = false
    setLoadState({ status: 'loading' })

    const load = async () => {
      if (isVersionIdDecidablyUnusable(versionId, filters)) {
        setLoadState({ status: 'error' })
        return
      }
      if (filters.permittedLanguageTags !== undefined) {
        const versionResponse = await fetchBibleContent({ path: `/v1/bibles/${versionId}` })
        if (cancelled) return
        const { languageId } = versionMetaFromBody(versionResponse.body)
        if (
          versionResponse.status !== 200 ||
          !isUsableBibleVersion({ id: versionId, languageTag: languageId ?? undefined }, filters)
        ) {
          setLoadState({ status: 'error' })
          return
        }
      }

      const response = await fetchBibleContent({ path: `/v1/bibles/${versionId}/books` })
      if (cancelled) return
      if (response.status !== 200) {
        setLoadState({ status: 'error' })
        return
      }
      const catalog = catalogFromBooksBody(response.body)
      setLoadState(
        catalog === null
          ? { status: 'error' }
          : { status: 'ready', books: booksFromCatalog(catalog) },
      )
    }

    void load().catch(() => {
      if (!cancelled) setLoadState({ status: 'error' })
    })

    return () => {
      cancelled = true
    }
  }, [fetchBibleContent, filters, requestGeneration, versionId])

  const visibleBooks = useMemo(
    () =>
      loadState.status === 'ready'
        ? visibleChapterPickerBooks(loadState.books, query, order, lng)
        : [],
    [lng, loadState, order, query],
  )

  const retry = useCallback(() => setRequestGeneration((generation) => generation + 1), [])
  const selectChapter = useCallback(
    async (selectedBook: string, selectedChapter: string) => {
      if (selectionPendingRef.current) return false
      selectionPendingRef.current = true
      setPendingChapterId(`${selectedBook}.${selectedChapter}`)
      try {
        await onSelect?.({ book: selectedBook, chapter: selectedChapter, versionId })
        return true
      } catch {
        return false
      } finally {
        selectionPendingRef.current = false
        setPendingChapterId(null)
      }
    },
    [onSelect, versionId],
  )

  return {
    loadState,
    visibleBooks,
    query,
    order,
    expandedBookId,
    pendingChapterId,
    setQuery,
    setOrder,
    setExpandedBookId,
    retry,
    selectChapter,
  }
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

function sameVersionFilters(a: InternalVersionFilterProps, b: InternalVersionFilterProps): boolean {
  return (
    sameOptionalList(a.permittedVersionIds, b.permittedVersionIds) &&
    sameOptionalList(a.excludedVersionIds, b.excludedVersionIds) &&
    sameOptionalList(a.permittedLanguageTags, b.permittedLanguageTags)
  )
}
