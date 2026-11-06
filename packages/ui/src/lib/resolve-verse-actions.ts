import type { PlatformOSType } from 'react-native'

/**
 * Which verse-action value the reader host passes to the chapter body.
 *
 * iOS and Android get `'none'`, because `BibleVerseActionSheet` renders the
 * reference, swatch tray, Copy, and Share natively over the passage. Web gets
 * `'popover'`. `NativeSheet` renders nothing there, and Expo web is out of scope.
 *
 * The platform is an argument instead of a `Platform.OS` read, which makes the
 * branch testable at layer 1. A layer-3 test always runs as one platform, so it
 * cannot see the fork.
 */
export function resolveVerseActions(platformOS: PlatformOSType): 'popover' | 'none' {
  return platformOS === 'web' ? 'popover' : 'none'
}
