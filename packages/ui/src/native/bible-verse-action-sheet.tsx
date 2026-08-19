import { useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { SHEET_FOREGROUND, SHEET_MUTED_BACKGROUND, SHEET_STROKE } from '../lib/native-sheet-theme'
import type { Theme } from '../lib/resolve-theme'
import { swatchTrayFadeGates, type SwatchTrayMetrics } from '../lib/verse-action-fade-gates'
import type { VerseActionSwatch } from '../lib/verse-action-swatches'
import { getImpl, registerDefault } from './component-impls'
import { CheckIcon, CopyIcon, ShareIcon } from './icons'
import { NativeSheet } from './native-sheet'

/**
 * Highlight fill alpha: full strength in light mode, faded in dark. Each swatch
 * previews at the alpha it paints, so the dark tray reads dimmer.
 */
const FILL_OPACITY = { light: 1, dark: 0.3 } satisfies Record<Theme, number>

/**
 * Row metrics. The swatch tray and both action tiles share one row height, and
 * the tiles set it. The row is `alignItems: 'stretch'`, so only the tile (icon
 * over label) is measured. `ROW_HEIGHT` records that height, so the sizes
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

/**
 * Vertical travel, in points, before the sheet's pan gesture may take over.
 *
 * Without it the tray does not scroll on Android at all. Gorhom's pan has no
 * activation criteria by default, so RNGH falls back to a direction-agnostic
 * touch slop and the sheet claims a sideways drag — which cancels the touch
 * stream in the `ScrollView` underneath it. The trailing fade still rendered, so
 * the tray knew swatches were hidden; they were simply unreachable. Overflow is
 * routine here (seven swatches the moment a selection spans two colors), which
 * made that a common case, not an edge one.
 *
 * A vertical-only threshold is the fix that keeps both halves. Turning the
 * content pan off also scrolls the tray, but takes swipe-down with it — and this
 * is the one sheet with no backdrop, so swipe-down is its only exit that does
 * not require acting on the sheet. Verified on device: with content panning off,
 * neither a pan nor a fling on the grabber closed it.
 *
 * 10 sits just above Android's ~8dp touch slop, so a horizontal drag reliably
 * reaches the tray first, while a swipe-down clears it in its opening points.
 */
const PAN_ACTIVE_OFFSET_Y: [number, number] = [-10, 10]

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
 * Presentational only. `lib/verse-action-swatches.ts` decides which swatches to
 * show. Acting on a press, which means writing the highlight and clearing the
 * selection, is the reader's job.
 */
function BibleVerseActionSheetImpl({
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

  // Each edge shows its fade only while swatches are hidden under it. The
  // gates (`lib/verse-action-fade-gates.ts`) use remaining distance on the
  // trailing edge and distance already scrolled on the leading, not raw
  // overflow, so a fade retires at the end it guards. Gating on overflow
  // leaves the outermost swatch permanently dimmed, which reads as disabled.
  //
  // Layout and offset stay in a ref. React state holds only the two booleans
  // the fades mount on, so a drag does not re-render the sheet every frame.
  const metricsRef = useRef<SwatchTrayMetrics>({
    trayWidth: 0,
    contentWidth: 0,
    scrollX: 0,
  })
  const [hasScrolledPast, setHasScrolledPast] = useState(false)
  const [hasMoreToScroll, setHasMoreToScroll] = useState(false)

  const syncFadeGates = () => {
    const next = swatchTrayFadeGates(metricsRef.current)
    setHasScrolledPast(next.hasScrolledPast)
    setHasMoreToScroll(next.hasMoreToScroll)
  }

  return (
    // Non-modal: the user is still building the selection, so the passage behind
    // stays bright and tappable. A backdrop would take the tap that extends the
    // selection. The exits are swipe-down, deselection, and the sheet's own
    // buttons.
    //
    // `panActiveOffsetY` keeps the swatch tray scrollable without giving any of
    // that up: the sheet's pan needs vertical intent, so a sideways drag belongs
    // to the tray. See PAN_ACTIVE_OFFSET_Y.
    <NativeSheet
      isOpen={isOpen}
      onClose={onClose}
      theme={theme}
      modal={false}
      panActiveOffsetY={PAN_ACTIVE_OFFSET_Y}
    >
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
              onLayout={(event) => {
                metricsRef.current.trayWidth = event.nativeEvent.layout.width
                syncFadeGates()
              }}
              onContentSizeChange={(width) => {
                metricsRef.current.contentWidth = width
                syncFadeGates()
              }}
              onScroll={(event) => {
                metricsRef.current.scrollX = event.nativeEvent.contentOffset.x
                syncFadeGates()
              }}
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
                   * pick against the fill. Light mode paints a full-strength
                   * swatch in Text/Everdark, and dark mode fades the fill to
                   * 30%. White reads on both.
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

registerDefault('BibleVerseActionSheet', BibleVerseActionSheetImpl)

export function BibleVerseActionSheet(props: BibleVerseActionSheetProps): ReactNode {
  const Impl = getImpl('BibleVerseActionSheet')
  return <Impl {...props} />
}

/**
 * One end of the swatch tray, fading the scrolling strip into the tray surface.
 * It is opaque at the tray's outer edge and transparent where the swatches are
 * legible.
 *
 * Both edges share one `x1 → x2` direction and swap only the stop opacities, so
 * they cannot drift apart. `theme` is in the gradient id because both fades can
 * be on screen at once, and SVG defs share one id namespace.
 */
function SwatchTrayFade({ edge, theme }: { edge: 'leading' | 'trailing'; theme: Theme }) {
  const isLeading = edge === 'leading'
  const gradientId = `yv-verse-swatch-fade-${edge}-${theme}`

  return (
    <View
      testID={`bible-verse-action-swatch-fade-${edge}`}
      // Sits over the scrolling swatches but must never take their taps. The
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
  /** Tray plus both tiles, one row. `stretch` is what gives them a shared height. */
  row: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 8,
  },
  /**
   * A fixed-width window that clips a horizontally scrolling strip of swatches.
   * `flex: 1` takes the row's slack. The tray does not grow or animate.
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
   * `flexGrow: 1` stretches the content to the tray, so `space-evenly` spreads
   * the swatches across it. Past that point the content outgrows the tray and
   * scrolls, and `gap` supplies the spacing `space-evenly` has no slack for.
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
  /** Compact, roughly square, and *not* `flex: 1`. The tray takes the slack. */
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
