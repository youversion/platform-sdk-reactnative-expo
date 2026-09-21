import type { NonBlankQuery, TitledVerse } from './bible-reader-search'
import type { AppendState, Loading, SearchState } from './bible-reader-search-machine'

export type ResultsFooter =
  | { readonly kind: 'none' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly onRetry: () => void }

/**
 * The single value the sheet reads. Six mutually exclusive arms, so a spinner and a list
 * cannot coexist. `pending` carries no verses, so a stub-titled row is not a state the sheet
 * can be handed.
 */
export type SearchView =
  | {
      readonly phase: 'browsing'
      readonly trending: Loading<readonly NonBlankQuery[]>
      readonly recents: readonly NonBlankQuery[]
    }
  | { readonly phase: 'suggesting'; readonly suggestions: readonly NonBlankQuery[] }
  | { readonly phase: 'pending' }
  | {
      readonly phase: 'results'
      /** Never empty. A resolved page with no verses projects to `empty`. */
      readonly verses: readonly TitledVerse[]
      readonly footer: ResultsFooter
      readonly onEndReached: () => void
    }
  | { readonly phase: 'empty' }
  | { readonly phase: 'failed'; readonly onRetry: () => void }

export type SearchViewHandlers = {
  readonly retrySearch: () => void
  readonly loadNextPage: () => void
}

const NO_QUERIES: readonly NonBlankQuery[] = []

function footerOf(append: AppendState, loadNextPage: () => void): ResultsFooter {
  if (append.status === 'loading') {
    return { kind: 'loading' }
  }
  if (append.status === 'error') {
    return { kind: 'error', onRetry: loadNextPage }
  }
  return { kind: 'none' }
}

/** Projects machine state plus locally persisted recents into the render contract. */
export function toSearchView(
  state: SearchState,
  recents: readonly NonBlankQuery[],
  handlers: SearchViewHandlers,
): SearchView {
  switch (state.kind) {
    case 'browsing':
      return { phase: 'browsing', trending: state.trending, recents }

    case 'typing': {
      if (state.suggestions.status === 'loading') {
        return { phase: 'suggesting', suggestions: NO_QUERIES }
      }
      return { phase: 'suggesting', suggestions: state.suggestions.value }
    }

    case 'searching':
      return { phase: 'pending' }

    case 'resolved': {
      const { verses, append } = state.page
      if (verses.length === 0) {
        return { phase: 'empty' }
      }
      return {
        phase: 'results',
        verses,
        footer: footerOf(append, handlers.loadNextPage),
        // The reducer refuses a page it cannot serve, so the list may fire this freely.
        onEndReached: handlers.loadNextPage,
      }
    }

    case 'failed':
      return { phase: 'failed', onRetry: handlers.retrySearch }
  }
}
