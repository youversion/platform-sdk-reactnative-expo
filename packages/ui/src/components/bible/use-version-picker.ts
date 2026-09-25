import { ApiClient, BibleClient, LanguagesClient } from '@youversion/platform-core'
import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { useLocales } from 'expo-localization'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { detectDeviceLocale } from '../../i18n/detect-device-locale'
import { versionMetaFromBody } from '../../lib/bible-version-abbreviation'
import { getSdkHeaders } from '../../lib/sdk-version'
import type { InternalVersionFilterProps } from '../../lib/version-filter-props'
import { filterLanguagesBySearch, filterVersions } from '../../lib/filter-versions'
import {
  nextPanel,
  type VersionPickerPanel,
  type VersionPickerPanelEvent,
} from '../../lib/version-picker-panels'
import { isUsableBibleVersion, languageTagsWithUsableVersions } from '../../lib/version-usability'
import {
  buildSuggestedLanguages,
  fetchSuggestedVersionPickerLanguages,
  fetchAllVersionSummaries,
  fetchVersionLanguageTags,
  fetchVersionPickerLanguages,
  fetchVersionsForLanguage,
  languagesWithBibles,
  type VersionPickerLanguage,
  type VersionPickerVersion,
} from '../../native/bible-version-picker-api'
import { useRecentBibleVersionsStore } from '../../stores/recent-bible-versions-store'

export type VersionPickerLoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready' }

export type VersionPickerLanguageTab = 'suggested' | 'all'

export type VersionPickerController = {
  loadState: VersionPickerLoadState
  panel: VersionPickerPanel
  versionSearchQuery: string
  languageSearchQuery: string
  languageTab: VersionPickerLanguageTab
  selectedLanguageId: string
  selectedVersionId: number
  recentVersions: readonly VersionPickerVersion[]
  filteredVersions: readonly VersionPickerVersion[]
  suggestedLanguages: readonly VersionPickerLanguage[]
  allLanguages: readonly VersionPickerLanguage[]
  filteredLanguages: readonly VersionPickerLanguage[]
  totalLanguages: number
  pendingVersionId: number | null
  versionLookupFailed: boolean
  setVersionSearchQuery: (query: string) => void
  setLanguageSearchQuery: (query: string) => void
  setLanguageTab: (tab: VersionPickerLanguageTab) => void
  dispatchPanelEvent: (event: VersionPickerPanelEvent) => void
  retry: () => void
  selectLanguage: (languageId: string) => void
  selectVersion: (version: VersionPickerVersion) => Promise<boolean>
}

const DEFAULT_API_HOST = 'api.youversion.com'

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

function deviceLanguageCodes(locales: ReturnType<typeof useLocales>): string[] {
  const codes: string[] = []
  for (const locale of locales) {
    const code = locale.languageCode
    if (code && code.length > 0) {
      codes.push(code.toLowerCase())
    }
  }
  if (codes.length > 0) {
    return codes
  }
  const fallback = detectDeviceLocale(locales[0])
  return fallback ? [fallback] : []
}

export function useVersionPicker({
  versionId,
  selectedLanguageId: initialLanguageId,
  onSelect,
}: {
  versionId: number
  selectedLanguageId?: string
  onSelect?: (versionId: number) => void | Promise<void>
}): VersionPickerController {
  const {
    appKey,
    apiHost,
    installationId,
    fetchBibleContent,
    permittedVersionIds,
    excludedVersionIds,
    permittedLanguageTags,
  } = useYouVersion()
  const locales = useLocales()
  const deviceLanguageKey = deviceLanguageCodes(locales).join(',')
  const recentVersionIds = useRecentBibleVersionsStore((state) => state.versionIds)
  const recordVersionSelection = useRecentBibleVersionsStore(
    (state) => state.recordVersionSelection,
  )

  const incomingFilters: InternalVersionFilterProps = {
    permittedVersionIds,
    excludedVersionIds,
    permittedLanguageTags,
  }
  const [filters, setFilters] = useState(incomingFilters)
  const filtersMatch = sameVersionFilters(filters, incomingFilters)
  if (!filtersMatch) {
    setFilters(incomingFilters)
  }
  let activeFilters = filters
  if (!filtersMatch) {
    activeFilters = incomingFilters
  }

  const [loadState, setLoadState] = useState<VersionPickerLoadState>({ status: 'loading' })
  const [panel, setPanel] = useState<VersionPickerPanel>('versions')
  const [versionSearchQuery, setVersionSearchQuery] = useState('')
  const [languageSearchQuery, setLanguageSearchQuery] = useState('')
  const [languageTab, setLanguageTab] = useState<VersionPickerLanguageTab>('suggested')
  const [pickedLanguageId, setPickedLanguageId] = useState(initialLanguageId)
  const [selectedLanguageId, setSelectedLanguageId] = useState(initialLanguageId ?? '')
  const [selectedVersionId, setSelectedVersionId] = useState(versionId)
  const [versions, setVersions] = useState<readonly VersionPickerVersion[]>([])
  const [versionById, setVersionById] = useState<ReadonlyMap<number, VersionPickerVersion>>(
    () => new Map(),
  )
  const [allLanguages, setAllLanguages] = useState<readonly VersionPickerLanguage[]>([])
  const [suggestedLanguages, setSuggestedLanguages] = useState<readonly VersionPickerLanguage[]>([])
  const [languageTagByVersionId, setLanguageTagByVersionId] = useState<ReadonlyMap<number, string>>(
    () => new Map(),
  )
  const [pendingVersionId, setPendingVersionId] = useState<number | null>(null)
  const [versionLookupFailed, setVersionLookupFailed] = useState(false)
  const [requestGeneration, setRequestGeneration] = useState(0)
  const selectionPendingRef = useRef(false)

  useEffect(() => {
    setSelectedVersionId(versionId)
  }, [versionId])

  useEffect(() => {
    if (initialLanguageId !== undefined) {
      setPickedLanguageId(initialLanguageId)
    }
  }, [initialLanguageId])

  useEffect(() => {
    let cancelled = false
    setLoadState({ status: 'loading' })

    const load = async () => {
      try {
        const host = apiHost || DEFAULT_API_HOST
        const apiClient = new ApiClient({
          appKey,
          apiHost: host,
          installationId,
          additionalHeaders: getSdkHeaders(),
        })
        const clients = {
          languagesClient: new LanguagesClient(apiClient),
          bibleClient: new BibleClient(apiClient),
        }

        const [languages, countryLanguages, tags, summaries] = await Promise.all([
          fetchVersionPickerLanguages(clients),
          fetchSuggestedVersionPickerLanguages(clients),
          fetchVersionLanguageTags(clients),
          fetchAllVersionSummaries(clients),
        ])
        if (cancelled) {
          return
        }

        const unique = languagesWithBibles(languages, tags)
        const suggested = buildSuggestedLanguages(
          unique,
          countryLanguages,
          deviceLanguageKey.split(',').filter((code) => code.length > 0),
        )
        const nextVersionById = new Map<number, VersionPickerVersion>()
        for (const item of summaries) {
          nextVersionById.set(item.id, {
            ...item,
            languageTag: item.languageTag || tags.get(item.id) || '',
          })
        }
        setAllLanguages(unique)
        setSuggestedLanguages(suggested)
        setLanguageTagByVersionId(tags)
        setVersionById(nextVersionById)

        let languageId = pickedLanguageId
        if (!languageId) {
          try {
            const versionResponse = await fetchBibleContent({ path: `/v1/bibles/${versionId}` })
            if (cancelled) {
              return
            }
            languageId = versionMetaFromBody(versionResponse.body).languageId ?? undefined
          } catch {
            if (cancelled) {
              return
            }
            setVersionLookupFailed(true)
            setSelectedLanguageId('')
            setVersions([])
            setLoadState({ status: 'ready' })
            return
          }
        }
        if (!languageId) {
          setVersionLookupFailed(false)
          setSelectedLanguageId('')
          setVersions([])
          setLoadState({ status: 'ready' })
          return
        }
        const nextVersions = await fetchVersionsForLanguage(clients, languageId)
        if (cancelled) {
          return
        }
        setVersionLookupFailed(false)
        setSelectedLanguageId(languageId)
        setVersions(nextVersions)
        setLoadState({ status: 'ready' })
      } catch {
        if (!cancelled) {
          setLoadState({ status: 'error' })
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [
    apiHost,
    appKey,
    deviceLanguageKey,
    fetchBibleContent,
    installationId,
    pickedLanguageId,
    requestGeneration,
    versionId,
  ])

  const dispatchPanelEvent = useCallback((event: VersionPickerPanelEvent) => {
    setPanel((current) => nextPanel(current, event))
    if (event === 'sheet-opened') {
      setVersionSearchQuery('')
      setLanguageSearchQuery('')
      setLanguageTab('suggested')
    }
    if (event === 'close-language') {
      setLanguageSearchQuery('')
      setLanguageTab('suggested')
    }
  }, [])

  const retry = useCallback(() => setRequestGeneration((generation) => generation + 1), [])

  const selectLanguage = useCallback((languageId: string) => {
    setPickedLanguageId(languageId)
    setSelectedLanguageId(languageId)
    setLanguageSearchQuery('')
    setLanguageTab('suggested')
    setPanel('versions')
  }, [])

  const allowedLanguageTags = useMemo(
    () => languageTagsWithUsableVersions(languageTagByVersionId, activeFilters),
    [activeFilters, languageTagByVersionId],
  )

  const visibleLanguages = useMemo(
    () => allLanguages.filter((language) => allowedLanguageTags.has(language.id)),
    [allLanguages, allowedLanguageTags],
  )

  const visibleSuggestedLanguages = useMemo(
    () => suggestedLanguages.filter((language) => allowedLanguageTags.has(language.id)),
    [allowedLanguageTags, suggestedLanguages],
  )

  const recentVersions = useMemo(() => {
    const matching = !versionSearchQuery.trim()
      ? recentVersionIds
      : recentVersionIds.filter((id) => {
          const version = versionById.get(id)
          if (version === undefined) {
            return false
          }
          const query = versionSearchQuery.trim().toLowerCase()
          return (
            version.title.toLowerCase().includes(query) ||
            version.localizedAbbreviation.toLowerCase().includes(query) ||
            version.abbreviation.toLowerCase().includes(query)
          )
        })

    return matching
      .map((id) => versionById.get(id))
      .filter((version): version is VersionPickerVersion => version !== undefined)
      .filter((version) =>
        isUsableBibleVersion(
          { id: version.id, languageTag: languageTagByVersionId.get(version.id) },
          activeFilters,
        ),
      )
  }, [activeFilters, languageTagByVersionId, recentVersionIds, versionById, versionSearchQuery])

  const filteredVersions = useMemo(() => {
    const usable = versions.filter((version) =>
      isUsableBibleVersion({ id: version.id, languageTag: version.languageTag }, activeFilters),
    )
    const filtered = filterVersions(
      usable,
      versionSearchQuery,
      selectedLanguageId,
      recentVersions.map((version) => version.id),
    )
    return filtered
      .map((version) => versions.find((item) => item.id === version.id))
      .filter((version): version is VersionPickerVersion => version !== undefined)
  }, [activeFilters, recentVersions, selectedLanguageId, versionSearchQuery, versions])

  const filteredLanguages = useMemo(
    () => filterLanguagesBySearch(visibleLanguages, languageSearchQuery),
    [languageSearchQuery, visibleLanguages],
  )

  const selectVersion = useCallback(
    async (version: VersionPickerVersion) => {
      if (selectionPendingRef.current) {
        return false
      }
      if (
        !isUsableBibleVersion({ id: version.id, languageTag: version.languageTag }, activeFilters)
      ) {
        return false
      }
      selectionPendingRef.current = true
      setPendingVersionId(version.id)
      try {
        await onSelect?.(version.id)
        recordVersionSelection(version.id)
        setSelectedVersionId(version.id)
        return true
      } catch {
        return false
      } finally {
        selectionPendingRef.current = false
        setPendingVersionId(null)
      }
    },
    [activeFilters, onSelect, recordVersionSelection],
  )

  return {
    loadState,
    panel,
    versionSearchQuery,
    languageSearchQuery,
    languageTab,
    selectedLanguageId,
    selectedVersionId,
    recentVersions,
    filteredVersions,
    suggestedLanguages: visibleSuggestedLanguages,
    allLanguages: visibleLanguages,
    filteredLanguages,
    totalLanguages: visibleLanguages.length,
    pendingVersionId,
    versionLookupFailed,
    setVersionSearchQuery,
    setLanguageSearchQuery,
    setLanguageTab,
    dispatchPanelEvent,
    retry,
    selectLanguage,
    selectVersion,
  }
}
