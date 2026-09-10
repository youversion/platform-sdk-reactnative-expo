import { View } from 'react-native'

let restore: (() => void) | null = null

/**
 * `@rn-primitives/popover` places the menu by calling `measure()` on the
 * trigger. Jest's React Native mock never runs that callback, so the menu
 * stays closed. A fake box is enough for tests that open a popover.
 */
export function stubViewMeasure(): void {
  if (restore !== null) {
    return
  }
  const proto = View.prototype
  const previous = proto.measure
  proto.measure = function measure(callback) {
    callback(0, 0, 40, 40, 12, 80)
  }
  restore = () => {
    proto.measure = previous
    restore = null
  }
}

export function restoreViewMeasure(): void {
  restore?.()
}
