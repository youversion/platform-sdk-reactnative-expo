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
import { SHEET_HANDLE, SHEET_SURFACE } from '../lib/native-sheet-theme'
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
  children: React.ReactNode
  // iOS pre-warms matchContents and ignores this flag.
  showAndroidLoader?: boolean
  loaderMinHeight?: number
  theme?: Theme
  backgroundColor?: string
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
  theme,
  backgroundColor,
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
        theme={theme}
        backgroundColor={backgroundColor}
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
  theme,
  backgroundColor,
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
  theme?: Theme
  backgroundColor?: string
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

  const surfaceColor = backgroundColor ?? (theme ? SHEET_SURFACE[theme] : undefined)
  const backgroundStyle = useMemo<StyleProp<ViewStyle>>(
    () => (surfaceColor ? { backgroundColor: surfaceColor } : undefined),
    [surfaceColor],
  )
  const handleIndicatorStyle = useMemo<StyleProp<ViewStyle>>(
    () => (theme ? [styles.handle, { backgroundColor: SHEET_HANDLE[theme] }] : styles.handle),
    [theme],
  )

  // Android-only: iOS pre-warms matchContents via the inert-host exception (ADR 0006).
  const isAndroidLoaderEnabled = showAndroidLoader && Platform.OS === 'android'
  const [isSheetContentReady, setIsSheetContentReady] = useState(!isAndroidLoaderEnabled)
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
  const outerPointerEvents: 'none' | 'box-none' | 'auto' =
    Platform.OS === 'android' ? (isActive ? 'auto' : 'none') : 'box-none'

  useEffect(() => {
    // A second footnote tap may keep isActive=true, so use openKey to snap open
    // again even when the boolean state did not change.
    const openKeyChanged = openKey !== lastOpenKeyRef.current
    // Re-show the loader when new content arrives (openKey bump).
    if (isAndroidLoaderEnabled && openKeyChanged) setIsSheetContentReady(false)
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
  }, [isActive, isOpen, openKey, onClose, isAndroidLoaderEnabled])

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
        containerStyle={
          suppressInactiveSheet ? styles.inactiveContainer : undefined
        }
        enablePanDownToClose={!suppressInactiveSheet}
        enableDynamicSizing
        enableHandlePanningGesture={!suppressInactiveSheet}
        enableContentPanningGesture={
          suppressInactiveSheet ? false : (enableContentPanningGesture ?? true)
        }
        backdropComponent={
          suppressInactiveSheet ? renderNoBackdrop : renderBackdrop
        }
        backgroundComponent={suppressInactiveSheet ? null : undefined}
        backgroundStyle={backgroundStyle}
        handleComponent={suppressInactiveSheet ? null : undefined}
        accessible={!suppressInactiveSheet}
        accessibilityElementsHidden={suppressInactiveSheet}
        importantForAccessibility={
          suppressInactiveSheet ? 'no-hide-descendants' : 'auto'
        }
        onChange={handleSheetChange}
        style={styles.sheet}
        handleIndicatorStyle={handleIndicatorStyle}
      >
        <BottomSheetView
          pointerEvents={suppressInactiveSheet ? 'none' : 'auto'}
          accessibilityElementsHidden={suppressInactiveSheet}
          importantForAccessibility={
            suppressInactiveSheet ? 'no-hide-descendants' : 'auto'
          }
          style={bottomSheetContentStyle}
        >
          <View
            testID="native-sheet-loader-wrapper"
            style={loaderWrapperStyle}
            collapsable={false}
          >
            <View
              testID="native-sheet-content"
              onLayout={isAndroidLoaderEnabled ? handleContentLayout : undefined}
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
