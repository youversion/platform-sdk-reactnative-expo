/**
 * Which verse-action UI the WebView reader should run, given the host platform.
 *
 * `'none'` on iOS and Android, where a native bottom sheet replaces the
 * in-WebView popover (YPE-3712).
 *
 * **`'popover'` on web.** `NativeSheet` returns `null` on web (see
 * `native/native-sheet.tsx`), so switching the popover off there leaves the
 * reader with no verse action UI at all — not a degraded one, none. This is the
 * same fallback `BibleCard` already makes for its sheet-backed handlers.
 *
 * The web popover's colour swatches are inert, because the reader is in
 * controlled mode with no `onHighlightApply` wired. That is unchanged from the
 * containment literal that preceded YPE-3710, and Copy / Share still work; a
 * popover with two working buttons beats nothing.
 */
export function resolveVerseActions(platformOS: string): 'popover' | 'none' {
  return platformOS === 'web' ? 'popover' : 'none'
}
