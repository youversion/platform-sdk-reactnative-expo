/**
 * Per-sheet BottomSheets, lifted to a root PortalHost and coordinated by a
 * shared active-sheet store.
 *
 * The content is usually an Expo DOM WebView. Keeping each sheet's content in
 * its own stable BottomSheetView avoids pre-warming a WebView inside a tiny
 * hidden wrapper, which breaks matchContents measurement on first open.
 */

import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { Portal, PortalHost } from '@rn-primitives/portal'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { create } from 'zustand'
import { sheetHorizontalMargin } from '../lib/native-sheet-max-width'
import { SHEET_HANDLE, SHEET_SURFACE, SHEET_TOP_SHADOW } from '../lib/native-sheet-theme'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import type { Theme } from '../lib/resolve-theme'

const HOST_NAME = 'native-sheet-host'
let nextSheetId = 0

type SheetState = {
  activeSheetId: number | null
}

const useSheetStore = create<SheetState>(() => ({
  activeSheetId: null,
}))

type NativeSheetProps = {
  isOpen: boolean
  // Re-open signal for repeated actions while isOpen is already true.
  openKey?: number
  contentStyle?: StyleProp<ViewStyle>
  enableContentPanningGesture?: boolean
  onClose: () => void
  // Fired when a backdrop tap or pan-down close animation starts, before onClose.
  onDismissKeyboardStart?: () => void
  // false drops the backdrop entirely, so content behind the sheet stays bright
  // and interactive. The backdrop is removed instead of made transparent because
  // Gorhom reads `enableTouchThrough` only for the initial pointerEvents, then
  // overwrites it to 'auto' on open. An invisible backdrop would still swallow
  // every tap. Tap-to-dismiss goes with the backdrop, so a non-modal caller owns
  // its own dismissal.
  modal?: boolean
  // Vertical travel, in points, before the sheet's pan gesture may activate.
  // Unset by default, and that default is what breaks a horizontally scrolling
  // child on Android: RNGH's PanGestureHandler falls back to `minDist`, the
  // platform touch slop, which is direction-agnostic — so a sideways drag over a
  // nested ScrollView activates the *sheet's* pan. Activation cancels the touch
  // stream in every native view underneath (RNGestureHandlerRootHelper's
  // RootViewGestureHandler.onCancel → onChildStartedNativeGesture), so the
  // ScrollView never scrolls at all.
  //
  // Supplying any custom activation criterion makes RNGH drop `minDist`
  // entirely (PanGestureHandler.kt), so a vertical-only threshold means a
  // horizontal drag can no longer reach the sheet. The child keeps its touches,
  // and once it starts scrolling it calls requestDisallowInterceptTouchEvent,
  // which RNGH turns into a cancel of the sheet's pan — a clean handoff.
  //
  // Reach for this instead of `enableContentPanningGesture={false}`, which cures
  // the same symptom by removing swipe-down. Gorhom applies the value to the
  // handle pan as well as the content pan; both still open on a deliberate drag.
  panActiveOffsetY?: [number, number]
  children: React.ReactNode
  // iOS pre-warms matchContents and ignores this flag.
  showAndroidLoader?: boolean
  loaderMinHeight?: number
  theme?: Theme
  backgroundColor?: string
  // Colors only the safe-area footer strip (e.g. muted, behind a search bar).
  // Meant for full-bleed content (paddingHorizontal: 0) so it lines up with the
  // WebView's edge-to-edge surface. Absent → footer matches the sheet surface.
  bottomInsetColor?: string
  showHeader?: boolean
  headerTitle?: string
}

const DEFAULT_LOADER_MIN_HEIGHT = 180
const CONTENT_READY_HEIGHT_THRESHOLD = 4

export function NativeSheet({
  isOpen,
  openKey,
  contentStyle,
  enableContentPanningGesture,
  onClose,
  onDismissKeyboardStart,
  modal = true,
  panActiveOffsetY,
  children,
  showAndroidLoader = false,
  loaderMinHeight = DEFAULT_LOADER_MIN_HEIGHT,
  theme,
  backgroundColor,
  bottomInsetColor,
  showHeader = false,
  headerTitle,
}: NativeSheetProps) {
  // Stable per-sheet ID, assigned once on first render. useState with a lazy
  // initializer keeps this out of the render-phase ref reads the new
  // react-hooks/refs rule flags (a useRef + .current assignment during render
  // is the older idiom for the same "compute once" intent).
  const [sheetId] = useState(() => nextSheetId++)

  const isActive = useSheetStore((s) => s.activeSheetId === sheetId)

  useEffect(() => {
    if (Platform.OS === 'web') return
    useSheetStore.setState((state) => {
      if (isOpen) return { activeSheetId: sheetId }
      if (state.activeSheetId === sheetId) return { activeSheetId: null }
      return state
    })
  }, [isOpen, sheetId])

  useEffect(() => {
    return () => {
      if (Platform.OS === 'web') return
      useSheetStore.setState((state) =>
        state.activeSheetId === sheetId ? { activeSheetId: null } : state,
      )
    }
  }, [sheetId])

  if (Platform.OS === 'web') return null

  return (
    <Portal name={`native-sheet-${sheetId}`} hostName={HOST_NAME}>
      <SheetHost
        isActive={isActive}
        isOpen={isOpen}
        openKey={openKey}
        contentStyle={contentStyle}
        enableContentPanningGesture={enableContentPanningGesture}
        onClose={onClose}
        onDismissKeyboardStart={onDismissKeyboardStart}
        modal={modal}
        panActiveOffsetY={panActiveOffsetY}
        showAndroidLoader={showAndroidLoader}
        loaderMinHeight={loaderMinHeight}
        theme={theme}
        backgroundColor={backgroundColor}
        bottomInsetColor={bottomInsetColor}
        showHeader={showHeader}
        headerTitle={headerTitle}
      >
        {children}
      </SheetHost>
    </Portal>
  )
}

function SheetHost({
  isActive,
  isOpen,
  openKey,
  contentStyle,
  enableContentPanningGesture,
  onClose,
  onDismissKeyboardStart,
  modal,
  panActiveOffsetY,
  children,
  showAndroidLoader,
  loaderMinHeight,
  theme,
  backgroundColor,
  bottomInsetColor,
  showHeader,
  headerTitle,
}: {
  isActive: boolean
  isOpen: boolean
  openKey?: number
  contentStyle?: StyleProp<ViewStyle>
  enableContentPanningGesture?: boolean
  onClose: () => void
  onDismissKeyboardStart?: () => void
  modal: boolean
  panActiveOffsetY?: [number, number]
  children: React.ReactNode
  showAndroidLoader: boolean
  loaderMinHeight: number
  theme?: Theme
  backgroundColor?: string
  bottomInsetColor?: string
  showHeader?: boolean
  headerTitle?: string
}) {
  const { bottom } = useSafeAreaInsets()
  const { width: windowWidth } = useWindowDimensions()
  const { t } = useSdkTranslation()
  const sheetRef = useRef<BottomSheet>(null)
  const wasActiveRef = useRef(false)
  const lastOpenKeyRef = useRef(openKey)
  const closingRef = useRef(false)
  // Safe-area spacing is rendered as a dedicated footer inset (below) rather
  // than paddingBottom here, so it can carry its own color (bottomInsetColor)
  // independent of the sheet surface.
  const bottomSheetContentStyle = useMemo(
    () => StyleSheet.flatten([styles.content, contentStyle]),
    [contentStyle],
  )

  // Cap and center the sheet surface on wide screens (iPad, landscape). The
  // margin lives on Gorhom's `style` prop (the BottomSheetBody, which contains
  // handle, header, content, and footer) so the whole surface is capped while
  // the sibling backdrop keeps covering the full screen. It applies to inactive
  // pre-warmed hosts too, so matchContents WebViews measure at the final width.
  // See lib/native-sheet-max-width.ts for why a margin instead of maxWidth.
  const sheetStyle = useMemo(() => {
    const margin = sheetHorizontalMargin(windowWidth)
    return margin > 0 ? [styles.sheet, { marginHorizontal: margin }] : styles.sheet
  }, [windowWidth])

  const surfaceColor = backgroundColor ?? (theme ? SHEET_SURFACE[theme] : undefined)
  // The shadow is keyed off `theme`, not `surfaceColor`. An explicit
  // `backgroundColor` on an unthemed sheet gets no shadow instead of a guessed
  // one. The shadow rides on `backgroundStyle` because Gorhom's default
  // background is a bare View that spreads it, with nothing between that View
  // and the window to clip it.
  const backgroundStyle = useMemo<StyleProp<ViewStyle>>(() => {
    if (!surfaceColor) return undefined
    if (!theme) return { backgroundColor: surfaceColor }
    return { backgroundColor: surfaceColor, boxShadow: SHEET_TOP_SHADOW[theme] }
  }, [surfaceColor, theme])
  const handleIndicatorStyle = useMemo<StyleProp<ViewStyle>>(
    () => (theme ? [styles.handle, { backgroundColor: SHEET_HANDLE[theme] }] : styles.handle),
    [theme],
  )

  // Android-only: iOS pre-warms matchContents via the inert-host exception (ADR 0006).
  const isAndroidLoaderEnabled = showAndroidLoader && Platform.OS === 'android'
  const [isSheetContentReady, setIsSheetContentReady] = useState(!isAndroidLoaderEnabled)
  // Re-show the loader when new content arrives (openKey bump). Adjusted during
  // render (not in the effect below) so the sheet never paints a frame with the
  // previous content marked ready. See
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevLoaderOpenKey, setPrevLoaderOpenKey] = useState(openKey)
  if (openKey !== prevLoaderOpenKey) {
    setPrevLoaderOpenKey(openKey)
    if (isAndroidLoaderEnabled) setIsSheetContentReady(false)
  }
  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!isAndroidLoaderEnabled) return
      if (event.nativeEvent.layout.height > CONTENT_READY_HEIGHT_THRESHOLD) {
        setIsSheetContentReady(true)
      }
    },
    [isAndroidLoaderEnabled],
  )
  const isLoading = isAndroidLoaderEnabled && !isSheetContentReady && isActive
  const loaderWrapperStyle = useMemo<StyleProp<ViewStyle>>(
    () => (isLoading ? { minHeight: loaderMinHeight } : undefined),
    [isLoading, loaderMinHeight],
  )

  // Android 12 needs an inert closed host; on iOS it breaks pre-warmed WebView sizing.
  const suppressInactiveSheet = Platform.OS === 'android' && !isActive

  // iOS uses box-none so the full-screen wrapper doesn't swallow taps; Android locks inactive sheets to none (ADR 0006).
  // A non-modal active sheet needs box-none on Android too. Without it the
  // wrapper eats the taps the dropped backdrop was supposed to let through.
  const outerPointerEvents: 'none' | 'box-none' | 'auto' =
    Platform.OS === 'android' ? (isActive ? (modal ? 'auto' : 'box-none') : 'none') : 'box-none'

  useEffect(() => {
    // A second footnote tap may keep isActive=true, so use openKey to snap open
    // again even when the boolean state did not change.
    const openKeyChanged = openKey !== lastOpenKeyRef.current
    if (isActive && (!wasActiveRef.current || openKeyChanged)) {
      closingRef.current = false
      sheetRef.current?.snapToIndex(0)
    } else if (!isActive && wasActiveRef.current) {
      closingRef.current = true
      sheetRef.current?.close()
      // If another sheet displaced this one, call onClose to keep the parent's isOpen in sync (so it can re-open).
      if (isOpen) onClose()
    }
    wasActiveRef.current = isActive
    lastOpenKeyRef.current = openKey
  }, [isActive, isOpen, openKey, onClose])

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index !== -1) {
        closingRef.current = false
        return
      }
      if (!closingRef.current && wasActiveRef.current) onClose()
      closingRef.current = false
    },
    [onClose],
  )

  const handleSheetAnimate = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex === -1 && fromIndex >= 0) onDismissKeyboardStart?.()
    },
    [onDismissKeyboardStart],
  )

  const renderSheetBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        pressBehavior="close"
        appearsOnIndex={0}
        disappearsOnIndex={-1}
      />
    ),
    [],
  )

  return (
    <View
      testID="native-sheet-inert-host"
      pointerEvents={outerPointerEvents}
      accessibilityElementsHidden={suppressInactiveSheet}
      importantForAccessibility={suppressInactiveSheet ? 'no-hide-descendants' : 'auto'}
      collapsable={false}
      style={StyleSheet.absoluteFill}
    >
      <BottomSheet
        ref={sheetRef}
        index={-1}
        animateOnMount={!suppressInactiveSheet}
        detached={suppressInactiveSheet && bottom > 0}
        bottomInset={suppressInactiveSheet ? bottom : 0}
        containerStyle={suppressInactiveSheet ? styles.inactiveContainer : undefined}
        enablePanDownToClose={!suppressInactiveSheet}
        enableDynamicSizing
        enableHandlePanningGesture={!suppressInactiveSheet}
        enableContentPanningGesture={
          suppressInactiveSheet ? false : (enableContentPanningGesture ?? true)
        }
        activeOffsetY={panActiveOffsetY}
        backdropComponent={suppressInactiveSheet || !modal ? renderNoBackdrop : renderSheetBackdrop}
        backgroundComponent={suppressInactiveSheet ? null : undefined}
        backgroundStyle={backgroundStyle}
        handleComponent={suppressInactiveSheet ? null : undefined}
        accessible={!suppressInactiveSheet}
        accessibilityElementsHidden={suppressInactiveSheet}
        importantForAccessibility={suppressInactiveSheet ? 'no-hide-descendants' : 'auto'}
        onChange={handleSheetChange}
        onAnimate={handleSheetAnimate}
        style={sheetStyle}
        handleIndicatorStyle={handleIndicatorStyle}
      >
        <BottomSheetView
          pointerEvents={suppressInactiveSheet ? 'none' : 'auto'}
          accessibilityElementsHidden={suppressInactiveSheet}
          importantForAccessibility={suppressInactiveSheet ? 'no-hide-descendants' : 'auto'}
          style={bottomSheetContentStyle}
        >
          {showHeader && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingBottom: 16,
                paddingHorizontal: 16,
              }}
            >
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={t('cancel')}
                testID="native-sheet-cancel-button"
                style={{ flex: 1 }}
              >
                <Text style={{ color: theme === 'dark' ? 'white' : 'black', fontSize: 16 }}>
                  {t('cancel')}
                </Text>
              </Pressable>
              <Text
                accessibilityLabel={headerTitle}
                testID="native-sheet-header-title"
                style={{
                  color: theme === 'dark' ? 'white' : 'black',
                  fontSize: 16,
                  fontWeight: 'bold',
                }}
              >
                {headerTitle}
              </Text>
              <View style={{ flex: 1 }} />
            </View>
          )}
          <View testID="native-sheet-loader-wrapper" style={loaderWrapperStyle} collapsable={false}>
            <View
              testID="native-sheet-content"
              onLayout={isAndroidLoaderEnabled ? handleContentLayout : undefined}
              collapsable={false}
            >
              {children}
            </View>
            {isLoading && (
              <View pointerEvents="none" style={styles.loaderOverlay} testID="native-sheet-loader">
                <ActivityIndicator size="large" accessibilityLabel={t('loading')} />
              </View>
            )}
          </View>
          {bottom > 0 && (
            <View
              testID="native-sheet-bottom-inset"
              style={{ height: bottom, backgroundColor: bottomInsetColor }}
            />
          )}
        </BottomSheetView>
      </BottomSheet>
    </View>
  )
}

const renderNoBackdrop = () => null

export function NativeSheetProvider({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') return <>{children}</>
  return (
    <>
      {children}
      <PortalHost name={HOST_NAME} />
    </>
  )
}

const styles = StyleSheet.create({
  sheet: {
    zIndex: 1000,
  },
  inactiveContainer: {
    transform: [{ translateY: 1000 }],
  },
  handle: {
    backgroundColor: '#ccc',
  },
  content: {
    paddingHorizontal: 8,
  },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
