/**
 * Verses a mounted `useHighlights` is currently sending.
 *
 * Queue-first writes leave an entry in MMKV for the whole life of a write, so
 * the queue alone cannot tell the drain which entries are already in hand.
 * Without this the drain re-sends them, and a re-tap in that window races two
 * paths that can settle in either order.
 *
 * One-directional: the drain defers to the hook, never the reverse.
 */

import type { HighlightScope } from './constants'

/** Refcounted — overlapping writes to one verse each hold their own claim. */
const claims = new Map<string, number>()

function claimKey(userId: string, scope: HighlightScope, verse: number): string {
  return `${userId}|${scope.versionId}|${scope.book}|${scope.chapter}|${verse}`
}

/** Returns an idempotent release; settle and unmount may both call it. */
export function claimWrites(
  userId: string,
  scope: HighlightScope,
  verses: readonly number[],
): () => void {
  const keys = verses.map((verse) => claimKey(userId, scope, verse))
  for (const key of keys) {
    claims.set(key, (claims.get(key) ?? 0) + 1)
  }

  let released = false
  return () => {
    if (released) {
      return
    }
    released = true
    for (const key of keys) {
      const remaining = (claims.get(key) ?? 0) - 1
      if (remaining > 0) {
        claims.set(key, remaining)
      } else {
        claims.delete(key)
      }
    }
  }
}

export function isWriteClaimed(userId: string, scope: HighlightScope, verse: number): boolean {
  return claims.has(claimKey(userId, scope, verse))
}
