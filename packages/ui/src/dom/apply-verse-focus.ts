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
 * `handledSeq` is what this JS instance already applied. `appliedSeq` is what
 * native last acknowledged. Expo can boot a reload with a stale first snapshot
 * and then send the current pair on `$$dom_ready`, so both are needed. The
 * first mount passes 0 for each, so a focus queued before the Reader appears
 * still runs. The Web SDK throws on a passage it rejects, and that throw
 * clears the WebView root, so it is logged and dropped.
 */
export function applyMountedVerseFocus(
  caller: VerseFocusCaller,
  verseFocus: BibleReaderVerseFocus,
  handledSeq: number,
  appliedSeq: number = handledSeq,
): number {
  const acknowledged = Math.max(handledSeq, appliedSeq)
  if (!verseFocus.shouldFocus || verseFocus.seq <= acknowledged) {
    return acknowledged
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
