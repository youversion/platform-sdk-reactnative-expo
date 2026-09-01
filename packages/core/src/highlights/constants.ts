import { isValidHighlightHex } from './paint-projection'

export const MMKV_HIGHLIGHTS_KEY_PREFIX = 'yvp.highlights.' as const

/** Distinct from the cache prefix, so sign-out purges the queue by its own call, not by a prefix match. */
export const MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX = 'yvp.highlightqueue.' as const

/**
 * The six highlight swatches for apply. Partner apps may share a highlights DB
 * with the main Bible app, which can paint valid non-palette hex from the API;
 * only apply is restricted to this list.
 *
 * Duplicated from `@youversion/platform-react-ui`'s `HIGHLIGHT_COLORS` rather
 * than imported: that package peer-depends on `react-dom` (which core must not
 * require of a native consumer), exposes no deep import path, and would pull a
 * second `@youversion/platform-core` into this package's subtree. A pinning
 * test guards the values. Upstream ask: relocate the palette into
 * `@youversion/platform-core`, which both SDKs already depend on, and make this
 * a re-export.
 */
export const HIGHLIGHT_COLORS = [
  'ffec5b',
  'b4ffc1',
  'bbf4ff',
  'ffdca7',
  'ffcff8',
  'dfdcff',
] as const

export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

const HIGHLIGHT_COLOR_SET: ReadonlySet<string> = new Set(HIGHLIGHT_COLORS)

/** Case-insensitive membership test against {@link HIGHLIGHT_COLORS}. */
export function isHighlightColor(color: string): color is HighlightColor {
  return HIGHLIGHT_COLOR_SET.has(color.toLowerCase())
}

function stripHighlightHexPrefix(color: string): string {
  return color.startsWith('#') ? color.slice(1) : color
}

function hexChannel(hex: string, offset: number): number {
  return Number.parseInt(stripHighlightHexPrefix(hex).slice(offset, offset + 2), 16)
}

function byteToHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0')
}

function requireMixHex(color: string): string {
  const hex = stripHighlightHexPrefix(color)
  if (!isValidHighlightHex(hex)) {
    throw new Error(`mixSrgb: expected a 6-digit hex color, got ${JSON.stringify(color)}`)
  }
  return hex
}

/**
 * `stored * p + surfaceBg * (1 - p)`. Duplicated from
 * `@youversion/platform-react-ui` next to {@link HIGHLIGHT_COLORS} for the same
 * peer-boundary reason. Returns lowercase hex, no `#`.
 * Invalid hex or `p` outside 0–1 throws.
 */
export function mixSrgb(stored: string, surfaceBg: string, p: number): string {
  if (!Number.isFinite(p) || p < 0 || p > 1) {
    throw new Error(`mixSrgb: expected p in the range 0–1, got ${p}`)
  }
  const storedHex = requireMixHex(stored)
  const surfaceHex = requireMixHex(surfaceBg)
  const q = 1 - p
  const r = hexChannel(storedHex, 0) * p + hexChannel(surfaceHex, 0) * q
  const g = hexChannel(storedHex, 2) * p + hexChannel(surfaceHex, 2) * q
  const b = hexChannel(storedHex, 4) * p + hexChannel(surfaceHex, 4) * q
  return `${byteToHex(r)}${byteToHex(g)}${byteToHex(b)}`
}

export type HighlightScope = {
  versionId: number
  book: string
  chapter: string
}

export type ServerColors = Record<number, string>

export type QueuedWrite = {
  local: string | null
  /**
   * What the server had before the user started editing this verse, restored if
   * the write is rejected. Survives a later write to the same verse.
   */
  server: string | null
}

/** Verse number -> its unsent write. An entry where the two states agree is dropped. */
export type QueuedWrites = Record<number, QueuedWrite>

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

/**
 * Every queue key belonging to one user, and the only thing the prefix scans in
 * `queue.ts` may match on. Built here rather than at each scan so it cannot
 * disagree with {@link highlightQueueKey}: a scan that stops matching fails
 * silently in both directions — the drain finds no scope to send, and sign-out
 * reports nothing to lose.
 */
export function highlightQueueUserPrefix(userId: string): string {
  return `${MMKV_HIGHLIGHT_QUEUE_KEY_PREFIX}${userId}.`
}

/** Keyed like the cache, so a tap rewrites one chapter's slice, not a global blob. */
export function highlightQueueKey(userId: string, scope: HighlightScope): string {
  return `${highlightQueueUserPrefix(userId)}${scope.versionId}.${scope.book}.${scope.chapter}`
}
