import type { SearchApiError } from '@youversion/platform-react-native-expo-core'

import { nonBlankQuery } from './bible-reader-search'
import type { NonBlankQuery, PageToken, TitledVerse, Usfm } from './bible-reader-search'

/**
 * Monotonic stamp bumped by every user-initiated event. Async events carry the epoch they
 * were issued under, so staleness is a pure rule rather than a ref-timing convention.
 */
export type Epoch = number

export type Loading<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'done'; readonly value: T }

/** `scheduled` is the debounce wait. `loading` is the suggestion request itself. */
export type SuggestionState =
  | { readonly status: 'scheduled' }
  | { readonly status: 'loading' }
  | { readonly status: 'done'; readonly value: readonly NonBlankQuery[] }

/** Append status for the second page onward. `error` is retryable without losing page one. */
export type AppendState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: SearchApiError }

export type ResultPage = {
  /** Only enriched verses. Each page lands whole. */
  readonly verses: readonly TitledVerse[]
  readonly nextPageToken: PageToken | null
  readonly append: AppendState
  /** Every usfm the API has returned, including ones enrichment dropped, so dedupe holds. */
  readonly seen: ReadonlySet<Usfm>
}

/**
 * `text` is the raw field text, so a trailing space the user is still typing survives the
 * round trip. `draft` is the branded form the network layer consumes.
 */
export type SearchState =
  | {
      readonly kind: 'browsing'
      readonly epoch: Epoch
      readonly text: string
      readonly trending: Loading<readonly NonBlankQuery[]>
    }
  | {
      readonly kind: 'typing'
      readonly epoch: Epoch
      readonly text: string
      readonly draft: NonBlankQuery
      readonly suggestions: SuggestionState
    }
  | { readonly kind: 'searching'; readonly epoch: Epoch; readonly submitted: NonBlankQuery }
  | {
      readonly kind: 'resolved'
      readonly epoch: Epoch
      readonly submitted: NonBlankQuery
      /** Raw field text. May differ from `submitted` by surrounding whitespace. */
      readonly text: string
      readonly page: ResultPage
    }
  | {
      readonly kind: 'failed'
      readonly epoch: Epoch
      readonly submitted: NonBlankQuery
      readonly error: SearchApiError
    }

/**
 * `resultsCommitted` and `pageCommitted` carry `TitledVerse[]`, never raw hits: the shell
 * awaits enrichment before dispatching, so no event can put an un-titled verse into state.
 */
export type SearchEvent =
  | { readonly type: 'opened' }
  | { readonly type: 'languageChanged' }
  | { readonly type: 'queryEdited'; readonly text: string }
  | { readonly type: 'suggestionsStarted'; readonly epoch: Epoch }
  | { readonly type: 'submitted'; readonly query: NonBlankQuery }
  | {
      readonly type: 'resultsRestored'
      readonly text: string
      readonly submitted: NonBlankQuery
      readonly epoch: Epoch
      readonly page: ResultPage
    }
  | { readonly type: 'retried' }
  | {
      readonly type: 'trendingLoaded'
      readonly epoch: Epoch
      readonly queries: readonly NonBlankQuery[]
    }
  | {
      readonly type: 'suggestionsLoaded'
      readonly epoch: Epoch
      readonly queries: readonly NonBlankQuery[]
    }
  | {
      readonly type: 'resultsCommitted'
      readonly epoch: Epoch
      readonly verses: readonly TitledVerse[]
      readonly seen: ReadonlySet<Usfm>
      readonly nextPageToken: PageToken | null
    }
  | { readonly type: 'searchFailed'; readonly epoch: Epoch; readonly error: SearchApiError }
  | { readonly type: 'pageRequested' }
  | {
      readonly type: 'pageCommitted'
      readonly epoch: Epoch
      readonly verses: readonly TitledVerse[]
      readonly seen: ReadonlySet<Usfm>
      readonly nextPageToken: PageToken | null
    }
  | { readonly type: 'pageFailed'; readonly epoch: Epoch; readonly error: SearchApiError }

/** Hits came back but not one of them could be titled, so there is nothing to show and retrying may help. */
export const ENRICHMENT_FAILED: SearchApiError = {
  kind: 'transient',
  message: 'Search results could not be loaded',
}

const LOADING = { status: 'loading' } as const
const SCHEDULED = { status: 'scheduled' } as const

export function initialSearchState(): SearchState {
  return { kind: 'browsing', epoch: 0, text: '', trending: LOADING }
}

function browsing(epoch: Epoch, text: string): SearchState {
  return { kind: 'browsing', epoch, text, trending: LOADING }
}

export function searchReducer(state: SearchState, event: SearchEvent): SearchState {
  switch (event.type) {
    case 'opened':
      return browsing(state.epoch + 1, '')

    case 'languageChanged': {
      if (state.kind === 'browsing') {
        return { ...state, epoch: state.epoch + 1, trending: LOADING }
      }
      if (state.kind === 'typing') {
        return { ...state, epoch: state.epoch + 1, suggestions: SCHEDULED }
      }
      return state
    }

    case 'queryEdited': {
      const draft = nonBlankQuery(event.text)
      if (draft === null) {
        if (state.kind === 'browsing' && state.text === event.text) {
          return state
        }
        return browsing(state.epoch + 1, event.text)
      }
      if (state.kind === 'typing' && state.text === event.text) {
        return state
      }
      return {
        kind: 'typing',
        epoch: state.epoch + 1,
        text: event.text,
        draft,
        suggestions: SCHEDULED,
      }
    }

    case 'suggestionsStarted': {
      if (state.kind !== 'typing' || event.epoch !== state.epoch) {
        return state
      }
      if (state.suggestions.status !== 'scheduled') {
        return state
      }
      return { ...state, suggestions: LOADING }
    }

    case 'submitted':
      return { kind: 'searching', epoch: state.epoch + 1, submitted: event.query }

    case 'resultsRestored':
      return {
        kind: 'resolved',
        epoch: event.epoch,
        submitted: event.submitted,
        text: event.text,
        page: event.page,
      }

    case 'retried': {
      if (state.kind !== 'failed') {
        return state
      }
      return { kind: 'searching', epoch: state.epoch + 1, submitted: state.submitted }
    }

    case 'trendingLoaded': {
      if (state.kind !== 'browsing' || event.epoch !== state.epoch) {
        return state
      }
      return { ...state, trending: { status: 'done', value: event.queries } }
    }

    case 'suggestionsLoaded': {
      if (state.kind !== 'typing' || event.epoch !== state.epoch) {
        return state
      }
      return { ...state, suggestions: { status: 'done', value: event.queries } }
    }

    case 'resultsCommitted': {
      if (state.kind !== 'searching' || event.epoch !== state.epoch) {
        return state
      }
      if (event.seen.size > 0 && event.verses.length === 0) {
        return {
          kind: 'failed',
          epoch: state.epoch,
          submitted: state.submitted,
          error: ENRICHMENT_FAILED,
        }
      }
      return {
        kind: 'resolved',
        epoch: state.epoch,
        submitted: state.submitted,
        text: state.submitted,
        page: {
          verses: event.verses,
          nextPageToken: event.nextPageToken,
          append: { status: 'idle' },
          seen: event.seen,
        },
      }
    }

    case 'searchFailed': {
      if (state.kind !== 'searching' || event.epoch !== state.epoch) {
        return state
      }
      return {
        kind: 'failed',
        epoch: state.epoch,
        submitted: state.submitted,
        error: event.error,
      }
    }

    case 'pageRequested': {
      if (state.kind !== 'resolved') {
        return state
      }
      const { nextPageToken, append } = state.page
      if (nextPageToken === null || append.status === 'loading') {
        return state
      }
      return { ...state, page: { ...state.page, append: LOADING } }
    }

    case 'pageCommitted': {
      if (state.kind !== 'resolved' || event.epoch !== state.epoch) {
        return state
      }
      if (state.page.append.status !== 'loading') {
        return state
      }
      return {
        ...state,
        page: {
          verses: [...state.page.verses, ...event.verses],
          nextPageToken: event.nextPageToken,
          append: { status: 'idle' },
          seen: new Set([...state.page.seen, ...event.seen]),
        },
      }
    }

    case 'pageFailed': {
      if (state.kind !== 'resolved' || event.epoch !== state.epoch) {
        return state
      }
      if (state.page.append.status !== 'loading') {
        return state
      }
      return {
        ...state,
        page: { ...state.page, append: { status: 'error', error: event.error } },
      }
    }
  }
}

/** Field text. The one selector the sheet needs that is not part of the view. */
export function fieldTextOf(state: SearchState): string {
  if (state.kind === 'searching' || state.kind === 'failed') {
    return state.submitted
  }
  return state.text
}

/** Which network work the current state wants. Read by the effects shell, not by the sheet. */
export type SearchDemand =
  | { readonly kind: 'none' }
  | { readonly kind: 'trending'; readonly epoch: Epoch }
  | {
      readonly kind: 'suggestions'
      readonly epoch: Epoch
      readonly query: NonBlankQuery
      readonly status: 'scheduled' | 'loading'
    }
  | { readonly kind: 'verses'; readonly epoch: Epoch; readonly query: NonBlankQuery }
  | {
      readonly kind: 'page'
      readonly epoch: Epoch
      readonly query: NonBlankQuery
      readonly token: PageToken
      readonly seen: ReadonlySet<Usfm>
    }

const NO_DEMAND: SearchDemand = { kind: 'none' }

/** Pure, so "what to fetch" is decided by the same tested function that decided the phase. */
export function demandOf(state: SearchState): SearchDemand {
  switch (state.kind) {
    case 'browsing': {
      if (state.trending.status === 'loading') {
        return { kind: 'trending', epoch: state.epoch }
      }
      return NO_DEMAND
    }
    case 'typing': {
      if (state.suggestions.status === 'done') {
        return NO_DEMAND
      }
      return {
        kind: 'suggestions',
        epoch: state.epoch,
        query: state.draft,
        status: state.suggestions.status,
      }
    }
    case 'searching':
      return { kind: 'verses', epoch: state.epoch, query: state.submitted }
    case 'resolved': {
      const { append, nextPageToken, seen } = state.page
      if (append.status !== 'loading' || nextPageToken === null) {
        return NO_DEMAND
      }
      return {
        kind: 'page',
        epoch: state.epoch,
        query: state.submitted,
        token: nextPageToken,
        seen,
      }
    }
    case 'failed':
      return NO_DEMAND
  }
}
