/** Standard iOS UITabBar content height — tab bar is a native overlay, not in safe-area insets. */
export const IOS_TAB_BAR_CLEARANCE = 49

/** Extra space so copyright doesn't sit flush against the bar. */
export const READER_SCROLL_END_GAP = 16

export type ReaderBottomScrollPaddingPlatform =
  | 'ios'
  | 'android'
  | 'web'
  | 'windows'
  | 'macos'
  | 'default'

export function computeReaderBottomScrollPadding(
  bottomSafeArea: number,
  platform: ReaderBottomScrollPaddingPlatform = 'default',
): number {
  if (platform === 'ios') {
    return IOS_TAB_BAR_CLEARANCE + bottomSafeArea + READER_SCROLL_END_GAP
  }
  // Android NativeTabs wraps screens in bottom SafeAreaView; only add a small gap when needed.
  if (platform === 'android') {
    return bottomSafeArea > 0 ? READER_SCROLL_END_GAP : 0
  }
  return 0
}
