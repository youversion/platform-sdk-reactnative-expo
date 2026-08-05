/**
 * Which verse-action UI the WebView reader should run, given the host platform.
 *
 * `'none'` on iOS and Android, where `BibleVerseActionSheet` replaces the
 * in-WebView popover: the reference label, the swatch tray, Copy, and Share all
 * render as native UI over the passage.
 *
 * **`'popover'` on web.** `NativeSheet` returns `null` on web (see
 * `native/native-sheet.tsx`), so switching the popover off there leaves the
 * reader with no verse action UI at all — not a degraded one, none. This is the
 * same fallback `BibleCard` already makes for its sheet-backed handlers.
 *
 * The web popover's colour swatches are inert, because the reader is in
 * controlled mode with no `onHighlightApply` wired. Copy and Share still work; a
 * popover with two working buttons beats nothing.
 *
 * The branch lives here rather than inline so it is testable at layer 1. A
 * platform fork is invisible to a layer-3 test, which always runs as one
 * platform, and it is unobservable inside the `'use dom'` file — which is also
 * why the DOM component reads the choice off a prop instead of `Platform.OS`:
 * that file executes in the WebView, where `react-native`'s `Platform` is not
 * the host's.
 */
export function resolveVerseActions(platformOS: string): 'popover' | 'none' {
  return platformOS === 'web' ? 'popover' : 'none'
}
