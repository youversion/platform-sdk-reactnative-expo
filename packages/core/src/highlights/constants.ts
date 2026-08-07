export const MMKV_HIGHLIGHTS_KEY_PREFIX = 'yvp.highlights.' as const

/**
 * The five highlight swatches, a company-wide standard across every YouVersion
 * SDK. Custom colors are not supported by the product, so both write paths
 * reject anything outside this list before painting or issuing a request.
 *
 * Duplicated from `@youversion/platform-react-ui`'s `HIGHLIGHT_COLORS` rather
 * than imported: that package peer-depends on `react-dom` (which core must not
 * require of a native consumer), exposes no deep import path, and would pull a
 * second `@youversion/platform-core` into this package's subtree. A pinning
 * test guards the values. Upstream ask: relocate the palette into
 * `@youversion/platform-core`, which both SDKs already depend on, and make this
 * a re-export.
 */
export const HIGHLIGHT_COLORS = ['fffe00', '5dff79', '00d6ff', 'ffc66f', 'ff95ef'] as const

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

/** Case-insensitive membership test against {@link HIGHLIGHT_COLORS}. */
export function isHighlightColor(color: string): color is HighlightColor {
  return (HIGHLIGHT_COLORS as readonly string[]).includes(color.toLowerCase())
}

export type HighlightScope = {
  versionId: number
  book: string
  chapter: string
}

export type ServerColors = Record<number, string>

/**
 * One copy of the message, shared by the write path and the permission flow that
 * wraps it. Both can report the same refusal, and two drifting copies of a
 * user-facing string is a bug waiting for a translator.
 */
export const NOT_SIGNED_IN_MESSAGE =
  'Not signed in — highlights require an authenticated YouVersion user.'

export function highlightsCacheKey(userId: string, scope: HighlightScope): string {
  return `${MMKV_HIGHLIGHTS_KEY_PREFIX}${userId}.${scope.versionId}.${scope.book}.${scope.chapter}`
}
