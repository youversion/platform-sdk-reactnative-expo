import { I18nManager } from 'react-native'

const { isRTL, doLeftAndRightSwapInRTL } = I18nManager.getConstants()

// Paint offsets are measured from the physical left. An RTL app reads `left` as start,
// which an RTL passage puts on the right, so there `right` is the physical left.
export function leftEdge(
  x: number,
  rtl: boolean,
  swapped: boolean = isRTL && doLeftAndRightSwapInRTL,
): { left: number } | { right: number } {
  return rtl && swapped ? { right: x } : { left: x }
}
