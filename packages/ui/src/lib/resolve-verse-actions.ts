import type { PlatformOSType } from 'react-native'

/**
 * Which verse-action UI the WebView reader should run, given the host platform.
 *
 * `'none'` on iOS and Android, where `BibleVerseActionSheet` renders the
 * reference, swatch tray, Copy, and Share natively over the passage.
 * `'popover'` on web, where `NativeSheet` renders nothing and suppressing the
 * in-WebView popover would leave no verse action UI at all.
 *
 * Takes the platform as an argument, rather than reading `Platform.OS`, so the
 * branch is testable at layer 1 — a platform fork is invisible to a layer-3 test
 * that always runs as one platform.
 */
export function resolveVerseActions(platformOS: PlatformOSType): 'popover' | 'none' {
  return platformOS === 'web' ? 'popover' : 'none'
}
