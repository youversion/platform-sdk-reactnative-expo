import {
  nonBlankQuery,
  type NonBlankQuery,
  type PageToken,
  type TitledVerse,
  type Usfm,
} from '../bible-reader-search'
import {
  demandOf,
  initialSearchState,
  searchReducer,
  type SearchEvent,
  type SearchState,
} from '../bible-reader-search-machine'

function query(text: string): NonBlankQuery {
  const branded = nonBlankQuery(text)
  if (branded === null) {
    throw new Error(`test fixture query is blank: ${text}`)
  }
  return branded
}

function usfm(value: string): Usfm {
  return value as Usfm
}

function token(value: string): PageToken {
  return value as PageToken
}

const JOHN_3_16: TitledVerse = {
  usfm: usfm('JHN.3.16'),
  title: 'John 3:16',
  snippet: 'For God so loved the world',
}

const PSALM_23_1: TitledVerse = {
  usfm: usfm('PSA.23.1'),
  title: 'Psalm 23:1',
  snippet: 'The Lord is my shepherd',
}

function reduce(state: SearchState, ...events: readonly SearchEvent[]): SearchState {
  return events.reduce(searchReducer, state)
}

function opened(): SearchState {
  return searchReducer(initialSearchState(), { type: 'opened' })
}

function resolvedWith(
  verses: readonly TitledVerse[],
  nextPageToken: PageToken | null = null,
): SearchState {
  const searching = reduce(opened(), { type: 'submitted', query: query('love') })
  return searchReducer(searching, {
    type: 'resultsCommitted',
    epoch: searching.epoch,
    verses,
    seen: new Set(verses.map((verse) => verse.usfm)),
    nextPageToken,
  })
}

describe('searchReducer', () => {
  it('opens on browsing with an empty field and trending in flight', () => {
    const state = opened()

    expect(state.kind).toBe('browsing')
    expect(demandOf(state)).toEqual({ kind: 'trending', epoch: state.epoch })
  })

  it('keeps the raw field text so a trailing space survives', () => {
    const state = reduce(opened(), { type: 'queryEdited', text: 'love ' })

    expect(state).toMatchObject({ kind: 'typing', text: 'love ', draft: 'love' })
  })

  it('returns to browsing when the field is cleared to whitespace', () => {
    const state = reduce(
      opened(),
      { type: 'queryEdited', text: 'love' },
      { type: 'queryEdited', text: '  ' },
    )

    expect(state).toMatchObject({ kind: 'browsing', text: '  ' })
  })

  it('ignores a repeated edit so the same query is not refetched', () => {
    const typing = reduce(opened(), { type: 'queryEdited', text: 'love' })

    expect(searchReducer(typing, { type: 'queryEdited', text: 'love' })).toBe(typing)
  })

  it('drops trending that arrives under a stale epoch', () => {
    const browsing = opened()
    const typing = searchReducer(browsing, { type: 'queryEdited', text: 'love' })

    expect(
      searchReducer(typing, {
        type: 'trendingLoaded',
        epoch: browsing.epoch,
        queries: [query('faith')],
      }),
    ).toBe(typing)
  })

  it('bumps the epoch on a language change so the in-flight trending is dropped', () => {
    const browsing = opened()
    const relanguaged = searchReducer(browsing, { type: 'languageChanged' })

    expect(relanguaged.epoch).toBe(browsing.epoch + 1)
    expect(demandOf(relanguaged)).toEqual({ kind: 'trending', epoch: relanguaged.epoch })
  })

  it('leaves a resolved search alone when the language changes', () => {
    const resolved = resolvedWith([JOHN_3_16])

    expect(searchReducer(resolved, { type: 'languageChanged' })).toBe(resolved)
  })

  it('holds searching until the whole first page is titled', () => {
    const searching = reduce(opened(), { type: 'submitted', query: query('love') })

    expect(searching.kind).toBe('searching')
    expect(demandOf(searching)).toEqual({ kind: 'verses', epoch: searching.epoch, query: 'love' })

    const resolved = searchReducer(searching, {
      type: 'resultsCommitted',
      epoch: searching.epoch,
      verses: [JOHN_3_16],
      seen: new Set([JOHN_3_16.usfm]),
      nextPageToken: null,
    })

    expect(resolved).toMatchObject({ kind: 'resolved', page: { verses: [JOHN_3_16] } })
  })

  it('resolves an empty page when the API returned no hits', () => {
    const searching = reduce(opened(), { type: 'submitted', query: query('love') })
    const resolved = searchReducer(searching, {
      type: 'resultsCommitted',
      epoch: searching.epoch,
      verses: [],
      seen: new Set(),
      nextPageToken: null,
    })

    expect(resolved).toMatchObject({ kind: 'resolved', page: { verses: [] } })
  })

  it('fails retryably when hits came back but nothing could be titled', () => {
    const searching = reduce(opened(), { type: 'submitted', query: query('love') })
    const failed = searchReducer(searching, {
      type: 'resultsCommitted',
      epoch: searching.epoch,
      verses: [],
      seen: new Set([usfm('JHN.3.16')]),
      nextPageToken: null,
    })

    expect(failed).toMatchObject({ kind: 'failed', submitted: 'love' })

    const retried = searchReducer(failed, { type: 'retried' })
    expect(retried).toMatchObject({ kind: 'searching', submitted: 'love' })
  })

  it('drops a result page that belongs to an abandoned query', () => {
    const searching = reduce(opened(), { type: 'submitted', query: query('love') })
    const typing = searchReducer(searching, { type: 'queryEdited', text: 'peace' })

    expect(
      searchReducer(typing, {
        type: 'resultsCommitted',
        epoch: searching.epoch,
        verses: [JOHN_3_16],
        seen: new Set([JOHN_3_16.usfm]),
        nextPageToken: null,
      }),
    ).toBe(typing)
  })

  it('refuses a next page when there is no cursor', () => {
    const resolved = resolvedWith([JOHN_3_16], null)

    expect(searchReducer(resolved, { type: 'pageRequested' })).toBe(resolved)
  })

  it('refuses a second page request while one is in flight', () => {
    const resolved = resolvedWith([JOHN_3_16], token('page-2'))
    const loading = searchReducer(resolved, { type: 'pageRequested' })

    expect(demandOf(loading)).toEqual({
      kind: 'page',
      epoch: loading.epoch,
      query: 'love',
      token: 'page-2',
      seen: new Set([JOHN_3_16.usfm]),
    })
    expect(searchReducer(loading, { type: 'pageRequested' })).toBe(loading)
  })

  it('appends a committed page and unions what it has seen', () => {
    const resolved = resolvedWith([JOHN_3_16], token('page-2'))
    const loading = searchReducer(resolved, { type: 'pageRequested' })
    const appended = searchReducer(loading, {
      type: 'pageCommitted',
      epoch: loading.epoch,
      verses: [PSALM_23_1],
      seen: new Set([PSALM_23_1.usfm]),
      nextPageToken: null,
    })

    expect(appended).toMatchObject({
      kind: 'resolved',
      page: { verses: [JOHN_3_16, PSALM_23_1], nextPageToken: null },
    })
    expect(demandOf(appended)).toEqual({ kind: 'none' })
  })

  it('keeps page one and allows a retry when the next page fails', () => {
    const resolved = resolvedWith([JOHN_3_16], token('page-2'))
    const loading = searchReducer(resolved, { type: 'pageRequested' })
    const failed = searchReducer(loading, {
      type: 'pageFailed',
      epoch: loading.epoch,
      error: { kind: 'transient', message: 'page failed' },
    })

    expect(failed).toMatchObject({
      kind: 'resolved',
      page: { verses: [JOHN_3_16], append: { status: 'error' } },
    })
    expect(searchReducer(failed, { type: 'pageRequested' })).toMatchObject({
      page: { append: { status: 'loading' } },
    })
  })

  it('wants suggestions for the draft while typing', () => {
    const typing = reduce(opened(), { type: 'queryEdited', text: 'lov' })

    expect(demandOf(typing)).toEqual({ kind: 'suggestions', epoch: typing.epoch, query: 'lov' })

    const loaded = searchReducer(typing, {
      type: 'suggestionsLoaded',
      epoch: typing.epoch,
      queries: [query('love one another')],
    })
    expect(demandOf(loaded)).toEqual({ kind: 'none' })
  })
})
