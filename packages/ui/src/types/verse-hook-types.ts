import type { ReactNode } from 'react'

/** One contiguous run of selected verses. Swift's merged `BibleReference`. */
export type BibleReaderVerseRange = {
  versionId: number
  /** USFM book code, e.g. `'JHN'`. */
  book: string
  chapter: string
  verseStart: number
  /** Equals `verseStart` for a single verse. */
  verseEnd: number
  /** `'JHN.3.16-18'`, or `'JHN.3.5'` for a single verse. */
  passageId: string
}

export type BibleReaderBuiltInVerseAction = 'highlight' | 'copy' | 'share'

export type BibleReaderCustomVerseAction = {
  /** Unique within the list. Also the testID suffix. */
  id: string
  /** Already localized by the host. */
  label: string
  /** Drawn in the sheet's foreground so it follows the theme. */
  icon: (props: { color: string; size: number }) => ReactNode
  /** Sorted, contiguous-merged ranges. Runs after the sheet closes and the selection clears. */
  onPress: (references: readonly BibleReaderVerseRange[]) => void | Promise<void>
}

export type BibleReaderVerseAction = BibleReaderBuiltInVerseAction | BibleReaderCustomVerseAction

/** The verse a {@link VerseIndicatorStyle} is resolved for. */
export type VerseIndicatorTarget = {
  versionId: number
  /** USFM book code, e.g. `'JHN'`. */
  book: string
  chapter: string
  verse: number
  /** `'JHN.3.16'`. */
  passageId: string
}

export type VerseIndicatorStyle = {
  /** Hex. Apply alpha with `withAlpha` at the call site. */
  backgroundColor: string
  /** Defaults to the verse-number ink. */
  foregroundColor?: string
  /** Square minimum tap size in points, centered on the marker. Default 44. */
  minimumHitSize?: number
  /** One no-break space on each side of the number, inside the marker. Default false. */
  inlinePadding?: boolean
  /** Defaults to the verse number. */
  accessibilityLabel?: string
}

/** Swift's `verseIndicatorStyle`. Return `null` to keep the plain verse number. */
export type VerseIndicatorStyleResolver = (target: VerseIndicatorTarget) => VerseIndicatorStyle | null
