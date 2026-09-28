export type KeyboardFrame = {
  screenY: number
  height: number
}

/**
 * Points of extra list padding so the last row can scroll above the keyboard.
 * The search sheet is already full height, so it cannot rise. `screenY` is the
 * top of the keyboard in the current window. A resized Android window reports
 * that top at the window bottom, and the padding stays 0. Some Android events
 * report `screenY` as 0 and put the size in `height`.
 */
export function searchListKeyboardPadding(
  windowHeight: number,
  bottomInset: number,
  keyboard: KeyboardFrame | null,
): number {
  if (keyboard === null) {
    return 0
  }
  let covered = windowHeight - keyboard.screenY
  if (keyboard.screenY <= 0) {
    covered = keyboard.height
  }
  return Math.max(0, covered - bottomInset)
}
