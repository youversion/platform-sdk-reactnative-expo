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
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { Platform, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
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
}

export function NativeSheet({
  isOpen,
  openKey,
  contentStyle,
  enableContentPanningGesture,
  onClose,
  children,
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

  const shouldSuppressInactiveHost =
    Platform.OS === 'android' && Number(Platform.Version) <= 31 && !isActive

  if (Platform.OS === 'web' || shouldSuppressInactiveHost) return null

  return (
    <Portal name={`native-sheet-${sheetId}`} hostName={HOST_NAME}>
      <SheetHost
        isActive={isActive}
        openKey={openKey}
        contentStyle={contentStyle}
        enableContentPanningGesture={enableContentPanningGesture}
        onClose={onClose}
      >
        {children}
      </SheetHost>
    </Portal>
  )
}

function SheetHost({
  isActive,
  openKey,
  contentStyle,
  enableContentPanningGesture,
  onClose,
  children,
}: {
  isActive: boolean
  openKey?: number
  contentStyle?: StyleProp<ViewStyle>
  enableContentPanningGesture?: boolean
  onClose: () => void
  children: React.ReactNode
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
  const enableActiveContentPanningGesture = isActive && (enableContentPanningGesture ?? true)

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
    }
    wasActiveRef.current = isActive
    lastOpenKeyRef.current = openKey
  }, [isActive, openKey])

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
    <BottomSheet
      ref={sheetRef}
      index={-1}
      animateOnMount={isActive}
      enablePanDownToClose={isActive}
      enableDynamicSizing
      enableHandlePanningGesture={isActive}
      enableContentPanningGesture={enableActiveContentPanningGesture}
      backdropComponent={isActive ? renderBackdrop : undefined}
      backgroundComponent={isActive ? undefined : null}
      handleComponent={isActive ? undefined : null}
      onChange={handleSheetChange}
      style={styles.sheet}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={bottomSheetContentStyle}>{children}</BottomSheetView>
    </BottomSheet>
  )
}

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop {...props} pressBehavior="close" appearsOnIndex={0} disappearsOnIndex={-1} />
)

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
  handle: {
    backgroundColor: '#ccc',
  },
  content: {
    paddingHorizontal: 8,
  },
})
