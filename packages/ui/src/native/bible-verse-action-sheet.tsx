import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { SHEET_MUTED_BACKGROUND } from '../lib/native-sheet-theme'
import type { Theme } from '../lib/resolve-theme'
import type { VerseActionSwatch } from '../lib/verse-action-swatches'
import { CheckIcon, CopyIcon, ShareIcon } from './icons'
import { NativeSheet } from './native-sheet'

/**
 * On-surface colors. The sheet *surface* comes from `NativeSheet`'s Sheet
 * Surface Parity tokens; these are the colors drawn on top of it, and the swatch
 * stroke matches the circle border the Web SDK's popover drew
 * (`rgba(18,18,18,0.2)` light / `rgba(255,255,255,0.2)` dark).
 */
const FOREGROUND: Record<Theme, string> = { light: '#121212', dark: '#ffffff' }
const SWATCH_STROKE: Record<Theme, string> = {
  light: 'rgba(18, 18, 18, 0.2)',
  dark: 'rgba(255, 255, 255, 0.2)',
}
/** Light mode paints the check in Text/Everdark; dark mode dims the fill, so it goes white. */
const CHECK_COLOR: Record<Theme, string> = { light: '#121212', dark: '#ffffff' }

/**
 * Highlight fill alpha, matching `verse.tsx` in the Web SDK (and the Swift SDK):
 * full strength in light mode, faded in dark. Previewing each swatch at the
 * alpha it will actually paint is why the dark tray looks dimmer than the light
 * one — that is the point, not a bug.
 */
const FILL_OPACITY: Record<Theme, number> = { light: 1, dark: 0.3 }

/**
 * Row metrics. The mock puts the swatch tray and both action tiles on a single
 * row of one shared height, and that height is set by the tiles (icon over
 * label) — so the row uses `alignItems: 'stretch'` and only the tile is
 * measured. `ROW_HEIGHT` is that measurement written down, purely so the two
 * numbers derived from it stay in sync when the tile's contents change.
 */
const ACTION_ICON_SIZE = 20
const ACTION_LABEL_LINE_HEIGHT = 16
const ACTION_LABEL_GAP = 2
const ACTION_PADDING_VERTICAL = 9
const ROW_HEIGHT =
  ACTION_PADDING_VERTICAL * 2 + ACTION_ICON_SIZE + ACTION_LABEL_GAP + ACTION_LABEL_LINE_HEIGHT

/** In the mock a swatch is about half the tray's height, and the tray is a rounded rect (~14% radius), not a pill. */
const SWATCH_SIZE = Math.round(ROW_HEIGHT / 2)
const CORNER_RADIUS = Math.round(ROW_HEIGHT * 0.14)
const CHECK_ICON_SIZE = 18

/**
 * Edge fades over the swatch tray, one swatch wide — the tray scrolls *under* a
 * gradient mask at each end rather than being hard-cut, which is what the mock
 * and the shipped Bible app both show.
 *
 * Drawn with `react-native-svg` (already a peer dependency, already used by the
 * sheet's icons) instead of `expo-linear-gradient`, which is neither a
 * dependency nor a peer here. Adding a native module would force every consumer
 * to rebuild their dev client, and a fade does not justify that.
 */
const FADE_WIDTH = SWATCH_SIZE

/** Minimum spacing between swatches once the tray overflows and `space-evenly` has no slack left. */
const SWATCH_GAP = 8

/** `fffe00` → `rgba(255, 254, 0, 0.3)`. Input is always 6-char hex, no `#`. */
function hexToRgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex, 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

export type BibleVerseActionSheetProps = {
  isOpen: boolean
  /** Localized display reference for the selection, e.g. `Hebrews 11:4`. */
  reference: string
  swatches: VerseActionSwatch[]
  onSwatchPress: (swatch: VerseActionSwatch) => void
  onCopyPress: () => void
  onSharePress: () => void
  /** Swipe-down, or displacement by another sheet. Both are a cancel. */
  onClose: () => void
  theme: Theme
}

/**
 * The verse action sheet: reference label, highlight swatch tray, Copy, Share.
 *
 * This replaces the Web SDK's in-WebView `VerseActionPopover`, which the reader
 * suppresses with `verseActions="none"` — matching Swift and Kotlin, where verse
 * actions have always been a native bottom sheet.
 *
 * **Presentational only.** It decides nothing: which swatches to show is
 * `lib/verse-action-swatches.ts`, what a swatch press means is the reader's
 * `handleSwatchPress` (which routes through core's Permission Flow), and
 * clearing the selection afterwards is the reader's job too.
 */
export function BibleVerseActionSheet({
  isOpen,
  reference,
  swatches,
  onSwatchPress,
  onCopyPress,
  onSharePress,
  onClose,
  theme,
}: BibleVerseActionSheetProps) {
  const { t } = useSdkTranslation()

  // Layout measurement, not a decision: each edge shows its fade only while
  // something is actually hidden under it. Six swatches fit; seven (two verses
  // of different colors) do not, and ten is the palette's worst case.
  //
  // Both are measured against *remaining* scroll distance rather than raw
  // overflow, so a fade retires when you reach the end it guards. Gating on
  // overflow alone left the outermost swatch permanently dimmed once you
  // scrolled to it, which reads as disabled. `scrollX` only moves these
  // booleans at the two boundaries.
  //
  // The leading fade is the answer to "I can't tell there are more colors back
  // that way" — without it the strip is hard-cut at the left edge and scrolled
  // swatches simply vanish.
  const [trayWidth, setTrayWidth] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [scrollX, setScrollX] = useState(0)
  const hasMoreToScroll = contentWidth - trayWidth - scrollX > 1
  const hasScrolledPast = scrollX > 1

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
          <View
            testID="bible-verse-action-swatches"
            style={[styles.swatchTray, { backgroundColor: SHEET_MUTED_BACKGROUND[theme] }]}
          >
            <ScrollView
              testID="bible-verse-action-swatch-scroll"
              horizontal
              showsHorizontalScrollIndicator={false}
              onLayout={(event) => setTrayWidth(event.nativeEvent.layout.width)}
              onContentSizeChange={(width) => setContentWidth(width)}
              onScroll={(event) => setScrollX(event.nativeEvent.contentOffset.x)}
              scrollEventThrottle={16}
              style={styles.swatchScroll}
              contentContainerStyle={styles.swatchTrayContent}
            >
              {swatches.map((swatch) => (
                <Pressable
                  key={`${swatch.color}-${swatch.state}`}
                  testID={`bible-verse-action-swatch-${swatch.state}-${swatch.color}`}
                  accessibilityRole="button"
                  accessibilityLabel={
                    swatch.state === 'remove'
                      ? t('clearHighlightAriaLabel')
                      : t('applyHighlightAriaLabel')
                  }
                  onPress={() => onSwatchPress(swatch)}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: hexToRgba(swatch.color, FILL_OPACITY[theme]),
                      borderColor: SWATCH_STROKE[theme],
                    },
                  ]}
                >
                  {swatch.state === 'remove' && (
                    <CheckIcon color={CHECK_COLOR[theme]} size={CHECK_ICON_SIZE} />
                  )}
                </Pressable>
              ))}
            </ScrollView>

            {hasScrolledPast && <SwatchTrayFade edge="leading" theme={theme} />}
            {hasMoreToScroll && <SwatchTrayFade edge="trailing" theme={theme} />}
          </View>

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

/**
 * One end of the swatch tray, fading the scrolling strip into the tray surface.
 *
 * The two edges are the same gradient mirrored: opaque at the tray's outer edge,
 * transparent where the swatches are legible. Only the stop opacities swap —
 * keeping one `x1 → x2` direction means the leading fade cannot drift out of
 * sync with the trailing one.
 *
 * `theme` is in the gradient id because both fades can be on screen at once and
 * SVG defs share one id namespace.
 */
function SwatchTrayFade({ edge, theme }: { edge: 'leading' | 'trailing'; theme: Theme }) {
  const isLeading = edge === 'leading'
  const gradientId = `yv-verse-swatch-fade-${edge}-${theme}`

  return (
    <View
      testID={`bible-verse-action-swatch-fade-${edge}`}
      // Sits over the scrolling swatches but must never take their taps — the
      // swatch under the fade is still a live target.
      pointerEvents="none"
      style={[styles.swatchFade, isLeading ? styles.swatchFadeLeading : styles.swatchFadeTrailing]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop
              offset="0"
              stopColor={SHEET_MUTED_BACKGROUND[theme]}
              stopOpacity={isLeading ? 1 : 0}
            />
            <Stop
              offset="1"
              stopColor={SHEET_MUTED_BACKGROUND[theme]}
              stopOpacity={isLeading ? 0 : 1}
            />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
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
  /** Tray + both tiles, one row. `stretch` is what makes them a shared height. */
  row: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  /**
   * The tray is a fixed-width window (`flex: 1`, taking the row's slack) that
   * clips a horizontally scrolling strip of swatches. It deliberately does *not*
   * grow or animate: the Bible app's widening tray belongs to an expand
   * interaction we are not porting, and the growth without the gesture would be
   * half of each design.
   */
  swatchTray: {
    borderRadius: CORNER_RADIUS,
    flex: 1,
    overflow: 'hidden',
  },
  /** Fills the tray's stretched height so the content container can center the swatches in it. */
  swatchScroll: {
    flex: 1,
  },
  /**
   * `flexGrow: 1` keeps the non-overflowing case identical to the old fixed row:
   * the content stretches to the tray and `space-evenly` spreads five swatches
   * across it. Past that the content simply outgrows the tray and scrolls, with
   * `gap` guaranteeing the spacing `space-evenly` no longer has slack to give.
   */
  swatchTrayContent: {
    alignItems: 'center',
    flexGrow: 1,
    gap: SWATCH_GAP,
    justifyContent: 'space-evenly',
    paddingHorizontal: 6,
  },
  swatchFade: {
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: FADE_WIDTH,
  },
  swatchFadeLeading: {
    left: 0,
  },
  swatchFadeTrailing: {
    right: 0,
  },
  swatch: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: SWATCH_SIZE,
    justifyContent: 'center',
    width: SWATCH_SIZE,
  },
  /** Compact, roughly square, and *not* `flex: 1` — the tray takes the slack. */
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
