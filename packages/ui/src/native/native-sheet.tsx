/**
 * Per-sheet BottomSheets, lifted to a root PortalHost and coordinated by a
 * shared active-sheet store.
 *
 * The content is usually an Expo DOM WebView. By default the sheet host (and
 * its WebView) mounts when the sheet opens and unmounts after the close
 * animation finishes — a warm-engine WebView cold start is ~170ms and hides
 * inside the open animation (ADR 0009). Sheets whose content needs network
 * data on first paint can pass `keepMounted` to pre-warm; those closed hosts
 * get the inert-host treatment on Android (ADR 0006).
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
  // Keep the host and content mounted while closed. Only worth it when the
  // content needs network data on first paint (e.g. pickers); the WebView
  // itself cold-starts fast enough to mount on open (ADR 0009).
  keepMounted?: boolean
  // Overlay a spinner until the content reports a real layout height.
  showLoader?: boolean
  loaderMinHeight?: number
  theme?: Theme
  backgroundColor?: string
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
  children,
  keepMounted = false,
  showLoader = false,
  loaderMinHeight = DEFAULT_LOADER_MIN_HEIGHT,
  theme,
  backgroundColor,
  showHeader = false,
  headerTitle,
}: NativeSheetProps) {
  const sheetIdRef = useRef<number | null>(null)
  if (sheetIdRef.current === null) {
    sheetIdRef.current = nextSheetId++
  }
  const sheetId = sheetIdRef.current

  const isActive = useSheetStore((s) => s.activeSheetId === sheetId)

  // Mount-on-open lifecycle: the host renders from open until the close
  // animation finishes (SheetHost reports that via onFullyClosed).
  const [isHostRendered, setIsHostRendered] = useState(isOpen)
  useEffect(() => {
    if (isOpen) setIsHostRendered(true)
  }, [isOpen])
  const handleHostFullyClosed = useCallback(() => setIsHostRendered(false), [])

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
  if (!keepMounted && !isHostRendered) return null

  return (
    <Portal name={`native-sheet-${sheetId}`} hostName={HOST_NAME}>
      <SheetHost
        isActive={isActive}
        isOpen={isOpen}
        openKey={openKey}
        contentStyle={contentStyle}
        enableContentPanningGesture={enableContentPanningGesture}
        onClose={onClose}
        onFullyClosed={keepMounted ? undefined : handleHostFullyClosed}
        keepMounted={keepMounted}
        showLoader={showLoader}
        loaderMinHeight={loaderMinHeight}
        theme={theme}
        backgroundColor={backgroundColor}
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
  onFullyClosed,
  keepMounted,
  children,
  showLoader,
  loaderMinHeight,
  theme,
  backgroundColor,
  showHeader,
  headerTitle,
}: {
  isActive: boolean
  isOpen: boolean
  openKey?: number
  contentStyle?: StyleProp<ViewStyle>
  enableContentPanningGesture?: boolean
  onClose: () => void
  onFullyClosed?: () => void
  keepMounted: boolean
  children: React.ReactNode
  showLoader: boolean
  loaderMinHeight: number
  theme?: Theme
  backgroundColor?: string
  showHeader?: boolean
  headerTitle?: string
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

  // Both platforms: mount-on-open content starts at zero height until the
  // matchContents size arrives, so the loader holds a stable initial pose.
  const isLoaderEnabled = showLoader
  const [isSheetContentReady, setIsSheetContentReady] = useState(!isLoaderEnabled)
  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!isLoaderEnabled) return
      if (event.nativeEvent.layout.height > CONTENT_READY_HEIGHT_THRESHOLD) {
        setIsSheetContentReady(true)
      }
    },
    [isLoaderEnabled],
  )
  const isLoading = isLoaderEnabled && !isSheetContentReady && isActive
  const loaderWrapperStyle = useMemo<StyleProp<ViewStyle>>(
    () => (isLoading ? { minHeight: loaderMinHeight } : undefined),
    [isLoading, loaderMinHeight],
  )

  // Only keep-mounted sheets have closed hosts to make inert (ADR 0006).
  // Android 12 needs the treatment; on iOS it breaks pre-warmed WebView sizing.
  // Mount-on-open hosts only exist while opening, open, or animating closed —
  // suppressing them would strip the chrome mid-animation.
  const suppressInactiveSheet = keepMounted && Platform.OS === 'android' && !isActive

  // iOS uses box-none so the full-screen wrapper doesn't swallow taps; Android locks inactive sheets to none (ADR 0006).
  const outerPointerEvents: 'none' | 'box-none' | 'auto' =
    Platform.OS === 'android' ? (isActive ? 'auto' : 'none') : 'box-none'

  useEffect(() => {
    // A second footnote tap may keep isActive=true, so use openKey to snap open
    // again even when the boolean state did not change.
    const openKeyChanged = openKey !== lastOpenKeyRef.current
    // Re-show the loader when new content arrives (openKey bump).
    if (isLoaderEnabled && openKeyChanged) setIsSheetContentReady(false)
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
  }, [isActive, isOpen, openKey, onClose, isLoaderEnabled])

  // Only treat index -1 as "fully closed" once the sheet has actually reached
  // an open index; some BottomSheet versions report -1 on mount, which would
  // unmount a mount-on-open host mid-open.
  const hasOpenedRef = useRef(false)
  const handleSheetChange = useCallback(
    (index: number) => {
      if (index !== -1) {
        hasOpenedRef.current = true
        closingRef.current = false
        return
      }
      if (!closingRef.current && wasActiveRef.current) onClose()
      closingRef.current = false
      // The close animation has finished — a mount-on-open host can unmount.
      if (hasOpenedRef.current) onFullyClosed?.()
    },
    [onClose, onFullyClosed],
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
      {/* Mount-on-open hosts mount at index 0 so animateOnMount performs the
          open — snapToIndex(0) is a no-op on a freshly mounted closed sheet.
          Keep-mounted hosts stay resident at -1 and open imperatively. */}
      <BottomSheet
        ref={sheetRef}
        index={keepMounted ? -1 : 0}
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
        backdropComponent={suppressInactiveSheet ? renderNoBackdrop : renderBackdrop}
        backgroundComponent={suppressInactiveSheet ? null : undefined}
        backgroundStyle={backgroundStyle}
        handleComponent={suppressInactiveSheet ? null : undefined}
        accessible={!suppressInactiveSheet}
        accessibilityElementsHidden={suppressInactiveSheet}
        importantForAccessibility={suppressInactiveSheet ? 'no-hide-descendants' : 'auto'}
        onChange={handleSheetChange}
        style={styles.sheet}
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
                marginHorizontal: 4,
              }}
            >
              <Pressable onPress={onClose} accessibilityRole="button" style={{ flex: 1 }}>
                <Text style={{ color: theme === 'dark' ? 'white' : 'black', fontSize: 16 }}>
                  Cancel
                </Text>
              </Pressable>
              <Text
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
              onLayout={isLoaderEnabled ? handleContentLayout : undefined}
              collapsable={false}
            >
              {children}
            </View>
            {isLoading && (
              <View pointerEvents="none" style={styles.loaderOverlay} testID="native-sheet-loader">
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
