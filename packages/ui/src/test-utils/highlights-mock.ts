import type {
  Highlight,
  HighlightScope,
  HighlightsFetchError,
  HighlightWriteOutcome,
  UseHighlightsOptions,
  UseHighlightsResult,
} from '@youversion/platform-react-native-expo-core'

/**
 * The controllable stand-in for core's `useHighlights`, installed once in
 * `jest.setup.js` alongside the wholesale mock of the core package.
 *
 * `useHighlights` reaches for MMKV, the network, and auth context that layer-3
 * native tests deliberately do not stand up — but the reader must still be able
 * to render highlights. Mocking it per test file would mean re-deriving the
 * whole `UseHighlightsResult` shape in every suite, so the default lives here
 * and tests steer it through {@link setMockHighlights}.
 */

const EMPTY: Highlight[] = []

type HighlightsResolver = (scope: HighlightScope) => Highlight[]

type MockState = {
  resolve: HighlightsResolver
  isRefreshing: boolean
  error: HighlightsFetchError | null
  hasPendingOperations: boolean
}

const state: MockState = {
  resolve: () => EMPTY,
  isRefreshing: false,
  error: null,
  hasPendingOperations: false,
}

/**
 * Writes and refreshes are recorded, never executed. Phase 2 asserts against
 * these; Phase 1 only needs them to exist so the returned shape is real.
 */
export const highlightsMock = {
  apply: jest.fn<Promise<HighlightWriteOutcome>, [string, number[]]>(async (_color, verses) => ({
    status: 'ok',
    verses,
  })),
  remove: jest.fn<Promise<HighlightWriteOutcome>, [string, number[]]>(async (_color, verses) => ({
    status: 'ok',
    verses,
  })),
  refresh: jest.fn<Promise<void>, []>(async () => {}),
}

/**
 * Set what `useHighlights` returns for `highlights`.
 *
 * Pass an array for a single fixed value (the same reference is returned on
 * every render, matching the referential stability core guarantees), or a
 * function to vary the result by scope — which is how a chapter change is
 * asserted to re-scope the hook rather than repaint the old chapter.
 */
export function setMockHighlights(next: Highlight[] | HighlightsResolver): void {
  state.resolve = typeof next === 'function' ? next : () => next
}

export function setMockHighlightsRefreshing(isRefreshing: boolean): void {
  state.isRefreshing = isRefreshing
}

export function setMockHighlightsError(error: HighlightsFetchError | null): void {
  state.error = error
}

/** Unsaved highlight work is waiting in the durable queue, or is on the wire. */
export function setMockHighlightsPending(hasPendingOperations: boolean): void {
  state.hasPendingOperations = hasPendingOperations
}

/** Restore the signed-out default. Call from `beforeEach`. */
export function resetHighlightsMock(): void {
  state.resolve = () => EMPTY
  state.isRefreshing = false
  state.error = null
  state.hasPendingOperations = false
  highlightsMock.apply.mockClear()
  highlightsMock.remove.mockClear()
  highlightsMock.refresh.mockClear()
}

/**
 * Real `useHighlights` memoizes `scope`, and the reader's orchestrator keys a
 * `useMemo` on it — so hand back the same object while the chapter is unchanged
 * rather than a fresh one per render.
 */
const scopeCache = new Map<string, HighlightScope>()

function stableScope(versionId: number, book: string, chapter: string): HighlightScope {
  const key = `${versionId}|${book}|${chapter}`
  const cached = scopeCache.get(key)
  if (cached !== undefined) {
    return cached
  }
  const scope: HighlightScope = { versionId, book, chapter }
  scopeCache.set(key, scope)
  return scope
}

export function createUseHighlightsMock(): (options: UseHighlightsOptions) => UseHighlightsResult {
  return function useHighlights({ versionId, book, chapter }: UseHighlightsOptions) {
    const scope = stableScope(versionId, book, chapter)
    return {
      highlights: state.resolve(scope),
      scope,
      isRefreshing: state.isRefreshing,
      error: state.error,
      hasPendingOperations: state.hasPendingOperations,
      refresh: highlightsMock.refresh,
      apply: highlightsMock.apply,
      remove: highlightsMock.remove,
    }
  }
}
