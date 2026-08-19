import type { Highlight } from '@youversion/platform-core'

import { useYVAuthOptional } from '../auth'
import { listCachedHighlights } from './cache'
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
 * Paint-only Cached Highlights for a Highlight Scope, including the null-scope
 * path (VOTD still loading, lookup failed, or invalid USFM).
 *
 * Hosts should keep using {@link useHighlights}. This is the paint-only
 * null-scope path used by Native Wrappers: a known scope subscribes at chapter
 * cache; a null scope yields every Cached Highlights row for the signed-in
 * user (Queued Writes folded in) so the Web SDK can clip to today's passage.
 * Signed out, it yields `[]` so Controlled Highlights Latch still holds.
 */
export function useHighlightPaint(scope: HighlightScope | null): Highlight[] {
  const enabled = scope !== null
  let versionId = DUMMY_HIGHLIGHT_SCOPE.versionId
  let book = DUMMY_HIGHLIGHT_SCOPE.book
  let chapter = DUMMY_HIGHLIGHT_SCOPE.chapter
  if (scope !== null) {
    versionId = scope.versionId
    book = scope.book
    chapter = scope.chapter
  }

  const { highlights } = useHighlights({ versionId, book, chapter, enabled })
  const userId = useYVAuthOptional()?.userInfo?.id ?? null

  if (scope !== null) {
    return highlights
  }
  if (userId === null) {
    return []
  }
  return listCachedHighlights(userId)
}
