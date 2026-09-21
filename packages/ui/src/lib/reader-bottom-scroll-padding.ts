/** Standard iOS UITabBar content height — tab bar is a native overlay, not in safe-area insets. */
export const IOS_TAB_BAR_CLEARANCE = 49

/** Extra space so copyright doesn't sit flush against the bar. */
export const READER_SCROLL_END_GAP = 16

export const READER_OVERLAY_NAV_SIZE = 42
export const READER_OVERLAY_NAV_EDGE_PADDING = 24
export const READER_OVERLAY_NAV_CLEARANCE =
  READER_OVERLAY_NAV_SIZE + READER_OVERLAY_NAV_EDGE_PADDING

export type ReaderBottomScrollPaddingPlatform =
  | 'ios'
  | 'android'
  | 'web'
  | 'windows'
  | 'macos'
  | 'default'

export function computeOverlayNavBottomOffset(
  bottomSafeArea: number,
  platform: ReaderBottomScrollPaddingPlatform = 'default',
): number {
  if (platform === 'ios') {
    return IOS_TAB_BAR_CLEARANCE + bottomSafeArea + READER_OVERLAY_NAV_EDGE_PADDING
  }
  if (platform === 'android') {
    return bottomSafeArea + READER_OVERLAY_NAV_EDGE_PADDING
  }
  return READER_OVERLAY_NAV_EDGE_PADDING
}

export function computeReaderBottomScrollPadding(
  bottomSafeArea: number,
  platform: ReaderBottomScrollPaddingPlatform = 'default',
  nativeToolbar = false,
): number {
  const overlay = nativeToolbar ? READER_OVERLAY_NAV_CLEARANCE : 0
  if (platform === 'ios') {
    return IOS_TAB_BAR_CLEARANCE + bottomSafeArea + READER_SCROLL_END_GAP + overlay
  }
  // Android NativeTabs wraps screens in bottom SafeAreaView; only add a small gap when needed.
  if (platform === 'android') {
    if (bottomSafeArea > 0) {
      return READER_SCROLL_END_GAP + overlay
    }
    return overlay
  }
  return overlay
}
