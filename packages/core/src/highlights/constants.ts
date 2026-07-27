export const MMKV_HIGHLIGHTS_KEY_PREFIX = 'yvp.highlights.' as const

export type HighlightScope = {
  versionId: number
  book: string
  chapter: string
}

export type ServerColors = Record<number, string>

export function highlightsCacheKey(userId: string, scope: HighlightScope): string {
  return `${MMKV_HIGHLIGHTS_KEY_PREFIX}${userId}.${scope.versionId}.${scope.book}.${scope.chapter}`
}
