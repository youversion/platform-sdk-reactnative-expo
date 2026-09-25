import {
  nonBlankQuery,
  type NonBlankQuery,
  type PageToken,
  type TitledVerse,
  type Usfm,
} from '../bible-reader-search'
import {
  fieldTextOf,
  initialSearchState,
  searchReducer,
  type SearchEvent,
  type SearchState,
} from '../bible-reader-search-machine'
import { toSearchView, type SearchViewHandlers } from '../bible-reader-search-view'

function query(text: string): NonBlankQuery {
  const branded = nonBlankQuery(text)
  if (branded === null) {
    throw new Error(`test fixture query is blank: ${text}`)
  }
  return branded
}

function usfm(value: string): Usfm {
  // SAFETY: test fixture USFMs are well-formed ids; the brand is a compile-time marker.
  return value as Usfm
}

function token(value: string): PageToken {
  // SAFETY: test fixture page tokens are non-empty strings; the brand is a compile-time marker.
  return value as PageToken
}

const JOHN_3_16: TitledVerse = {
  usfm: usfm('JHN.3.16'),
  title: 'John 3:16',
  snippet: 'For God so loved the world',
}

function handlers(): SearchViewHandlers {
  return { retrySearch: jest.fn(), loadNextPage: jest.fn() }
}

function reduce(state: SearchState, ...events: readonly SearchEvent[]): SearchState {
  return events.reduce(searchReducer, state)
}

function opened(): SearchState {
  return searchReducer(initialSearchState(), { type: 'opened' })
}

function searchingFor(text: string): SearchState {
  return reduce(opened(), { type: 'submitted', query: query(text) })
}

function resolvedWith(
  verses: readonly TitledVerse[],
  nextPageToken: PageToken | null = null,
): SearchState {
  const searching = searchingFor('love')
  return searchReducer(searching, {
    type: 'resultsCommitted',
    epoch: searching.epoch,
    verses,
    seen: new Set(verses.map((verse) => verse.usfm)),
    nextPageToken,
  })
}

describe('toSearchView', () => {
  it('shows trending as still loading and no recents on a cold open', () => {
    expect(toSearchView(opened(), [], handlers())).toEqual({
      phase: 'browsing',
      trending: { status: 'loading' },
      recents: [],
    })
  })

  it('hands recents through while trending is still loading', () => {
    const view = toSearchView(opened(), [query('grace')], handlers())

    expect(view).toEqual({
      phase: 'browsing',
      trending: { status: 'loading' },
      recents: ['grace'],
    })
  })

  it('hands trending through once it lands', () => {
    const browsing = opened()
    const loaded = searchReducer(browsing, {
      type: 'trendingLoaded',
      epoch: browsing.epoch,
      queries: [query('faith')],
    })

    expect(toSearchView(loaded, [], handlers())).toEqual({
      phase: 'browsing',
      trending: { status: 'done', value: ['faith'] },
      recents: [],
    })
  })

  it('caps browsing trending and recents at the visible query limit', () => {
    const browsing = opened()
    const loaded = searchReducer(browsing, {
      type: 'trendingLoaded',
      epoch: browsing.epoch,
      queries: [query('alpha'), query('beta'), query('gamma'), query('delta')],
    })
    const recents = [query('one'), query('two'), query('three'), query('four')]

    expect(toSearchView(loaded, recents, handlers())).toEqual({
      phase: 'browsing',
      trending: { status: 'done', value: ['alpha', 'beta', 'gamma'] },
      recents: ['one', 'two', 'three'],
    })
  })

  it('suggests nothing until the suggestions land', () => {
    const typing = reduce(opened(), { type: 'queryEdited', text: 'lov' })

    expect(toSearchView(typing, [], handlers())).toEqual({
      phase: 'suggesting',
      suggestions: [],
      loading: false,
    })

    const started = searchReducer(typing, { type: 'suggestionsStarted', epoch: typing.epoch })
    expect(toSearchView(started, [], handlers())).toEqual({
      phase: 'suggesting',
      suggestions: [],
      loading: true,
    })

    const loaded = searchReducer(started, {
      type: 'suggestionsLoaded',
      epoch: typing.epoch,
      queries: [query('love one another')],
    })
    expect(toSearchView(loaded, [], handlers())).toEqual({
      phase: 'suggesting',
      suggestions: ['love one another'],
      loading: false,
    })
  })

  it('carries no verses while the search is pending', () => {
    expect(toSearchView(searchingFor('love'), [], handlers())).toEqual({ phase: 'pending' })
  })

  it('paints results once the page is titled', () => {
    const view = toSearchView(resolvedWith([JOHN_3_16]), [], handlers())

    expect(view).toMatchObject({
      phase: 'results',
      verses: [{ usfm: 'JHN.3.16', title: 'John 3:16', snippet: 'For God so loved the world' }],
      footer: { kind: 'none' },
    })
  })

  it('projects a resolved page with no verses to empty', () => {
    expect(toSearchView(resolvedWith([]), [], handlers())).toEqual({ phase: 'empty' })
  })

  it('offers a retry on a failed search', () => {
    const searching = searchingFor('love')
    const failed = searchReducer(searching, {
      type: 'searchFailed',
      epoch: searching.epoch,
      error: { kind: 'transient', message: 'offline' },
    })
    const callbacks = handlers()
    const view = toSearchView(failed, [], callbacks)

    expect(view.phase).toBe('failed')
    if (view.phase === 'failed') {
      view.onRetry()
    }
    expect(callbacks.retrySearch).toHaveBeenCalledTimes(1)
  })

  it('marks the footer loading while a later page is in flight', () => {
    const loading = searchReducer(resolvedWith([JOHN_3_16], token('page-2')), {
      type: 'pageRequested',
    })

    expect(toSearchView(loading, [], handlers())).toMatchObject({
      phase: 'results',
      footer: { kind: 'loading' },
    })
  })

  it('retries the failed page from the footer', () => {
    const loading = searchReducer(resolvedWith([JOHN_3_16], token('page-2')), {
      type: 'pageRequested',
    })
    const failed = searchReducer(loading, {
      type: 'pageFailed',
      epoch: loading.epoch,
      error: { kind: 'transient', message: 'page failed' },
    })
    const callbacks = handlers()
    const view = toSearchView(failed, [], callbacks)

    expect(view.phase).toBe('results')
    if (view.phase === 'results' && view.footer.kind === 'error') {
      view.footer.onRetry()
    }
    expect(callbacks.loadNextPage).toHaveBeenCalledTimes(1)
  })
})

describe('fieldTextOf', () => {
  it('reads the raw draft while the field is editable', () => {
    expect(fieldTextOf(opened())).toBe('')
    expect(fieldTextOf(reduce(opened(), { type: 'queryEdited', text: 'love ' }))).toBe('love ')
  })

  it('reads the submitted query once a search is running', () => {
    expect(fieldTextOf(searchingFor('love'))).toBe('love')
    expect(fieldTextOf(resolvedWith([JOHN_3_16]))).toBe('love')
  })
})
