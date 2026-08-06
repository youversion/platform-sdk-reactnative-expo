import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { SHEET_FOREGROUND, SHEET_MUTED_BACKGROUND, SHEET_STROKE } from '../lib/native-sheet-theme'
import type { Theme } from '../lib/resolve-theme'
import type { VerseActionSwatch } from '../lib/verse-action-swatches'
import { CheckIcon, CopyIcon, ShareIcon } from './icons'
import { NativeSheet } from './native-sheet'

/**
 * Highlight fill alpha: full strength in light mode, faded in dark. Each swatch
 * previews at the alpha it will actually paint, so the dark tray reads dimmer.
 */
const FILL_OPACITY: Record<Theme, number> = { light: 1, dark: 0.3 }

/**
 * Row metrics. The swatch tray and both action tiles share one row height, set
 * by the tiles (icon over label) — the row is `alignItems: 'stretch'` and only
 * the tile is measured. `ROW_HEIGHT` records that measurement so the sizes
 * derived from it stay in sync when the tile's contents change.
 */
const ACTION_ICON_SIZE = 20
const ACTION_LABEL_LINE_HEIGHT = 16
const ACTION_LABEL_GAP = 2
const ACTION_PADDING_VERTICAL = 9
const ROW_HEIGHT =
  ACTION_PADDING_VERTICAL * 2 + ACTION_ICON_SIZE + ACTION_LABEL_GAP + ACTION_LABEL_LINE_HEIGHT

/** A swatch is about half the tray's height, and the tray is a rounded rect (~14% radius), not a pill. */
const SWATCH_SIZE = Math.round(ROW_HEIGHT / 2)
const CORNER_RADIUS = Math.round(ROW_HEIGHT * 0.14)
const CHECK_ICON_SIZE = 18

/**
 * Width of the gradient mask at each end of the swatch tray, so clipped swatches
 * fade instead of being hard-cut. One swatch wide.
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
 * The verse action sheet raised over a verse selection: reference label,
 * highlight swatch tray, Copy, and Share.
 *
 * Presentational only. Which swatches to show comes from
 * `lib/verse-action-swatches.ts`, and acting on a press — writing the highlight,
 * clearing the selection — is the reader's job.
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

  // Each edge shows its fade only while swatches are hidden under it. Measured
  // against *remaining* scroll distance rather than raw overflow, so a fade
  // retires at the end it guards instead of leaving the outermost swatch
  // permanently dimmed, which reads as disabled.
  const [trayWidth, setTrayWidth] = useState(0)
  const [contentWidth, setContentWidth] = useState(0)
  const [scrollX, setScrollX] = useState(0)
  const hasMoreToScroll = contentWidth - trayWidth - scrollX > 1
  const hasScrolledPast = scrollX > 1

  return (
    // Non-modal: the selection is still being built, so the passage behind stays
    // bright and tappable. A backdrop would swallow the tap that extends the
    // selection, leaving swipe-down, deselection, and the sheet's own buttons as
    // the only exits.
    <NativeSheet isOpen={isOpen} onClose={onClose} theme={theme} modal={false}>
      <View testID="bible-verse-action-sheet" style={styles.container}>
        <Text
          testID="bible-verse-action-reference"
          style={[styles.reference, { color: SHEET_FOREGROUND[theme] }]}
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
                      borderColor: SHEET_STROKE[theme],
                    },
                  ]}
                >
                  {/*
                   * The check takes the on-surface foreground, not a contrast
                   * pick against the fill: light mode paints a full-strength
                   * swatch in Text/Everdark, and dark mode fades the fill to
                   * 30%, so white reads on both.
                   */}
                  {swatch.state === 'remove' && (
                    <CheckIcon color={SHEET_FOREGROUND[theme]} size={CHECK_ICON_SIZE} />
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
            <CopyIcon color={SHEET_FOREGROUND[theme]} size={ACTION_ICON_SIZE} />
            <Text style={[styles.actionLabel, { color: SHEET_FOREGROUND[theme] }]}>
              {t('copy')}
            </Text>
          </Pressable>

          <Pressable
            testID="bible-verse-action-share"
            accessibilityRole="button"
            onPress={onSharePress}
            style={[styles.action, { backgroundColor: SHEET_MUTED_BACKGROUND[theme] }]}
          >
            <ShareIcon color={SHEET_FOREGROUND[theme]} size={ACTION_ICON_SIZE} />
            <Text style={[styles.actionLabel, { color: SHEET_FOREGROUND[theme] }]}>
              {t('share')}
            </Text>
          </Pressable>
        </View>
      </View>
    </NativeSheet>
  )
}

/**
 * One end of the swatch tray, fading the scrolling strip into the tray surface:
 * opaque at the tray's outer edge, transparent where the swatches are legible.
 *
 * Both edges share one `x1 → x2` direction and only swap the stop opacities, so
 * they cannot drift out of sync. `theme` is in the gradient id because both
 * fades can be on screen at once and SVG defs share one id namespace.
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
   * A fixed-width window (`flex: 1`, taking the row's slack) clipping a
   * horizontally scrolling strip of swatches. It does not grow or animate.
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
   * `flexGrow: 1` stretches the content to the tray so `space-evenly` spreads
   * the swatches across it; past that the content outgrows the tray and scrolls,
   * where `gap` supplies the spacing `space-evenly` no longer has slack for.
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
