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
 * an earlier WebView told native it finished. Native does not raise it until
 * that report, so a focus that arrived while this WebView was still loading
 * still has `appliedSeq` 0 and runs. A reload of a finished focus carries the
 * reported seq and does not run again. The Web SDK throws on a passage it
 * rejects, and that throw clears the WebView root, so it is logged and dropped.
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
