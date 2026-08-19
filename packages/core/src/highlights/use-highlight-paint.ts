import type { Highlight } from '@youversion/platform-core'

import type { HighlightScope } from './constants'
import { useHighlights } from './use-highlights'

/**
 * Dummy Highlight Scope used only so `useHighlights` is called unconditionally
 * while there is no real scope. Must never GET or persist — `enabled` is false.
 */
const DUMMY_HIGHLIGHT_SCOPE: HighlightScope = {
  versionId: 1,
  book: '_',
  chapter: '0',
}

/**
 * Paint-only Cached Highlights for a Highlight Scope.
 *
 * Hosts should keep using {@link useHighlights}. Native Wrappers use this
 * null-scope path: a known scope subscribes at chapter cache; a null scope
 * (VOTD still loading, lookup failed, or invalid USFM) yields `[]` so
 * Controlled Highlights Latch holds and stale other-scope rows cannot paint.
 */
export function useHighlightPaint(scope: HighlightScope | null): Highlight[] {
  const enabled = scope !== null
  const { versionId, book, chapter } = scope ?? DUMMY_HIGHLIGHT_SCOPE
  const { highlights } = useHighlights({ versionId, book, chapter, enabled })
  return highlights
}
