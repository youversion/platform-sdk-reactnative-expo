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
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { create } from 'zustand'

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
  children: React.ReactNode
  // iOS pre-warms matchContents and ignores this flag.
  showAndroidLoader?: boolean
  loaderMinHeight?: number
}

const DEFAULT_LOADER_MIN_HEIGHT = 180
const CONTENT_READY_HEIGHT_THRESHOLD = 4

export function NativeSheet({
  isOpen,
  openKey,
  contentStyle,
  enableContentPanningGesture,
  onClose,
  children,
  showAndroidLoader = false,
  loaderMinHeight = DEFAULT_LOADER_MIN_HEIGHT,
}: NativeSheetProps) {
  const sheetIdRef = useRef<number | null>(null)
  if (sheetIdRef.current === null) {
    sheetIdRef.current = nextSheetId++
  }
  const sheetId = sheetIdRef.current

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
        showAndroidLoader={showAndroidLoader}
        loaderMinHeight={loaderMinHeight}
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
  children,
  showAndroidLoader,
  loaderMinHeight,
}: {
  isActive: boolean
  isOpen: boolean
  openKey?: number
  contentStyle?: StyleProp<ViewStyle>
  enableContentPanningGesture?: boolean
  onClose: () => void
  children: React.ReactNode
  showAndroidLoader: boolean
  loaderMinHeight: number
}) {
  const { bottom } = useSafeAreaInsets()
  const sheetRef = useRef<BottomSheet>(null)
  const wasActiveRef = useRef(false)
  const lastOpenKeyRef = useRef(openKey)
  const closingRef = useRef(false)
  const bottomSheetContentStyle = useMemo(
    () => StyleSheet.flatten([styles.content, { paddingBottom: bottom }, contentStyle]),
    [bottom, contentStyle],
  )

  // Android-only: iOS pre-warms matchContents via the inert-host exception (ADR 0006).
  const loaderEnabled = showAndroidLoader && Platform.OS === 'android'
  const [contentReady, setContentReady] = useState(!loaderEnabled)
  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!loaderEnabled) return
      if (event.nativeEvent.layout.height > CONTENT_READY_HEIGHT_THRESHOLD) {
        setContentReady(true)
      }
    },
    [loaderEnabled],
  )
  const isLoading = loaderEnabled && !contentReady && isActive
  const loaderWrapperStyle = useMemo<StyleProp<ViewStyle>>(
    () => (isLoading ? { minHeight: loaderMinHeight } : undefined),
    [isLoading, loaderMinHeight],
  )

  // The Android 12 leak (ADR 0006) needs an inert closed host. iOS does not leak
  // the same way, and translating the host offscreen suspends matchContents in the
  // pre-warmed WebView — small DOM sheets then open before content has laid out
  // and visibly grow into place. Scope the inert-host treatment to Android.
  const suppressInactive = Platform.OS === 'android' && !isActive
  // The absoluteFill wrapper must never intercept touches itself — on iOS it would
  // otherwise cover the whole screen and swallow taps on the underlying app. On
  // Android we keep the explicit 'none' lock while inactive to satisfy ADR 0006.
  const outerPointerEvents: 'none' | 'box-none' | 'auto' =
    Platform.OS === 'android' ? (isActive ? 'auto' : 'none') : 'box-none'

  useEffect(() => {
    // A second footnote tap may keep isActive=true, so use openKey to snap open
    // again even when the boolean state did not change.
    const openKeyChanged = openKey !== lastOpenKeyRef.current
    // Re-show the loader when new content arrives (openKey bump).
    if (loaderEnabled && openKeyChanged) setContentReady(false)
    if (isActive && (!wasActiveRef.current || openKeyChanged)) {
      closingRef.current = false
      sheetRef.current?.snapToIndex(0)
    } else if (!isActive && wasActiveRef.current) {
      closingRef.current = true
      sheetRef.current?.close()
      // If isOpen is still true the parent did not initiate this close — another
      // sheet stole activeSheetId. Notify the parent so its state resyncs,
      // otherwise a subsequent tap on this sheet's trigger sets the same boolean
      // and React skips the update.
      if (isOpen) onClose()
    }
    wasActiveRef.current = isActive
    lastOpenKeyRef.current = openKey
  }, [isActive, isOpen, openKey, onClose, loaderEnabled])

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

  return (
    <View
      testID="native-sheet-inert-host"
      pointerEvents={outerPointerEvents}
      accessibilityElementsHidden={suppressInactive}
      importantForAccessibility={suppressInactive ? 'no-hide-descendants' : 'auto'}
      collapsable={false}
      style={StyleSheet.absoluteFill}
    >
      <BottomSheet
        ref={sheetRef}
        index={-1}
        animateOnMount={!suppressInactive}
        detached={suppressInactive && bottom > 0}
        bottomInset={suppressInactive ? bottom : 0}
        containerStyle={suppressInactive ? styles.inactiveContainer : undefined}
        enablePanDownToClose={!suppressInactive}
        enableDynamicSizing
        enableHandlePanningGesture={!suppressInactive}
        enableContentPanningGesture={
          suppressInactive ? false : (enableContentPanningGesture ?? true)
        }
        backdropComponent={suppressInactive ? renderNoBackdrop : renderBackdrop}
        backgroundComponent={suppressInactive ? null : undefined}
        handleComponent={suppressInactive ? null : undefined}
        accessible={!suppressInactive}
        accessibilityElementsHidden={suppressInactive}
        importantForAccessibility={suppressInactive ? 'no-hide-descendants' : 'auto'}
        onChange={handleSheetChange}
        style={styles.sheet}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView
          pointerEvents={suppressInactive ? 'none' : 'auto'}
          accessibilityElementsHidden={suppressInactive}
          importantForAccessibility={suppressInactive ? 'no-hide-descendants' : 'auto'}
          style={bottomSheetContentStyle}
        >
          <View
            testID="native-sheet-loader-wrapper"
            style={loaderWrapperStyle}
            collapsable={false}
          >
            <View
              testID="native-sheet-content"
              onLayout={loaderEnabled ? handleContentLayout : undefined}
              collapsable={false}
            >
              {children}
            </View>
            {isLoading && (
              <View
                pointerEvents="none"
                style={styles.loaderOverlay}
                testID="native-sheet-loader"
              >
                <ActivityIndicator size="large" accessibilityLabel="Loading" />
              </View>
            )}
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  )
}

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} pressBehavior="close" appearsOnIndex={0} disappearsOnIndex={-1} />
)

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
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
