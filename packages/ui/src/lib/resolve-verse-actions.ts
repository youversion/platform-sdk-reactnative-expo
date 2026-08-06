import type { PlatformOSType } from 'react-native'

/**
 * Which verse-action UI the WebView reader runs on a given platform.
 *
 * iOS and Android get `'none'`, because `BibleVerseActionSheet` renders the
 * reference, swatch tray, Copy, and Share natively over the passage. Web gets
 * `'popover'`, because `NativeSheet` renders nothing there, and suppressing the
 * in-WebView popover would leave no verse action UI at all.
 *
 * The platform is an argument instead of a `Platform.OS` read, which makes the
 * branch testable at layer 1. A layer-3 test always runs as one platform, so it
 * cannot see the fork.
 */
export function resolveVerseActions(platformOS: PlatformOSType): 'popover' | 'none' {
  return platformOS === 'web' ? 'popover' : 'none'
}
