import type { BibleReaderVerseFocus } from '../native/bible-reader-navigation'

export type VerseFocusCaller = {
  focusReference: (
    reference: { versionId: number; passageId: string },
    scrollsToVerse?: boolean,
  ) => void
}

/**
 * Apply one verse focus inside the WebView.
 *
 * `handledSeq` is the seq a previous WebView mount already applied. The first
 * mount passes 0, so a focus queued before the Reader appears still runs. A
 * reload passes that same seq and does not jump back. The Web SDK throws on a
 * passage it rejects, and that throw clears the WebView root, so it is logged
 * and dropped.
 */
export function applyMountedVerseFocus(
  caller: VerseFocusCaller,
  verseFocus: BibleReaderVerseFocus,
  handledSeq: number,
): number {
  if (!verseFocus.shouldFocus || verseFocus.seq <= handledSeq) {
    return handledSeq
  }
  try {
    caller.focusReference(
      { versionId: verseFocus.versionId, passageId: verseFocus.passageId },
      verseFocus.scrollsToVerse,
    )
  } catch (error) {
    console.error('BibleReader verse focus failed:', error)
  }
  return verseFocus.seq
}
