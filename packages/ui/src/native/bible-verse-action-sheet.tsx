import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { SHEET_MUTED_BACKGROUND } from '../lib/native-sheet-theme'
import type { Theme } from '../lib/resolve-theme'
import { CopyIcon, ShareIcon } from './icons'
import { NativeSheet } from './native-sheet'

/**
 * On-surface colors. The sheet *surface* comes from `NativeSheet`'s Sheet
 * Surface Parity tokens; these are the colors drawn on top of it.
 */
const FOREGROUND: Record<Theme, string> = { light: '#121212', dark: '#ffffff' }

/**
 * Row metrics. The mock puts the swatch tray and both action tiles on a single
 * row of one shared height, and that height is set by the tiles (icon over
 * label) — so the row uses `alignItems: 'stretch'` and only the tile is
 * measured. `ROW_HEIGHT` is that measurement written down, purely so the
 * numbers derived from it stay in sync when the tile's contents change.
 */
const ACTION_ICON_SIZE = 20
const ACTION_LABEL_LINE_HEIGHT = 16
const ACTION_LABEL_GAP = 2
const ACTION_PADDING_VERTICAL = 9
const ROW_HEIGHT =
  ACTION_PADDING_VERTICAL * 2 + ACTION_ICON_SIZE + ACTION_LABEL_GAP + ACTION_LABEL_LINE_HEIGHT

/** In the mock the tiles are rounded rects (~14% radius), not pills. */
const CORNER_RADIUS = Math.round(ROW_HEIGHT * 0.14)

export type BibleVerseActionSheetProps = {
  isOpen: boolean
  /** Localized display reference for the selection, e.g. `Hebrews 11:4`. */
  reference: string
  onCopyPress: () => void
  onSharePress: () => void
  /** Swipe-down, or displacement by another sheet. Both are a cancel. */
  onClose: () => void
  theme: Theme
}

/**
 * The verse action sheet: reference label, Copy, Share. The highlight swatch
 * tray joins this row next.
 *
 * This replaces the Web SDK's in-WebView `VerseActionPopover`, which the reader
 * suppresses with `verseActions="none"` — matching Swift and Kotlin, where verse
 * actions have always been a native bottom sheet.
 *
 * **Presentational only.** It decides nothing: what Copy and Share do is the
 * reader's job, and so is clearing the selection afterwards.
 */
export function BibleVerseActionSheet({
  isOpen,
  reference,
  onCopyPress,
  onSharePress,
  onClose,
  theme,
}: BibleVerseActionSheetProps) {
  const { t } = useSdkTranslation()

  return (
    // Non-modal: the selection this sheet acts on is still being built, so the
    // passage behind it stays bright and tappable. A modal backdrop swallowed
    // that tap and closed the sheet, which made multi-verse selection impossible.
    // Exits are now swipe-down, deselecting every verse, or acting on the sheet.
    <NativeSheet isOpen={isOpen} onClose={onClose} theme={theme} modal={false}>
      <View testID="bible-verse-action-sheet" style={styles.container}>
        <Text
          testID="bible-verse-action-reference"
          style={[styles.reference, { color: FOREGROUND[theme] }]}
        >
          {reference}
        </Text>

        <View style={styles.row}>
          <Pressable
            testID="bible-verse-action-copy"
            accessibilityRole="button"
            onPress={onCopyPress}
            style={[styles.action, { backgroundColor: SHEET_MUTED_BACKGROUND[theme] }]}
          >
            <CopyIcon color={FOREGROUND[theme]} size={ACTION_ICON_SIZE} />
            <Text style={[styles.actionLabel, { color: FOREGROUND[theme] }]}>{t('copy')}</Text>
          </Pressable>

          <Pressable
            testID="bible-verse-action-share"
            accessibilityRole="button"
            onPress={onSharePress}
            style={[styles.action, { backgroundColor: SHEET_MUTED_BACKGROUND[theme] }]}
          >
            <ShareIcon color={FOREGROUND[theme]} size={ACTION_ICON_SIZE} />
            <Text style={[styles.actionLabel, { color: FOREGROUND[theme] }]}>{t('share')}</Text>
          </Pressable>
        </View>
      </View>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  reference: {
    fontSize: 16,
    fontWeight: '600',
  },
  /** Both tiles, one row. `stretch` is what makes them a shared height. */
  row: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  /** Compact, roughly square, and *not* `flex: 1` — the swatch tray takes the slack. */
  action: {
    alignItems: 'center',
    borderRadius: CORNER_RADIUS,
    gap: ACTION_LABEL_GAP,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: ACTION_PADDING_VERTICAL,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: ACTION_LABEL_LINE_HEIGHT,
  },
})
