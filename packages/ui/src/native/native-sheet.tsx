/**
 * Portal-based bottom sheet rendered at the app root via @gorhom/bottom-sheet.
 *
 * WHY NOT React Native's `<Modal>`?
 * Modal unmounts its children when `visible={false}`. Our sheet content is a
 * DOM component (Expo "use dom" — renders in a WebView). WebViews take ~500ms+
 * to cold-start, so every open/close cycle would flash a blank sheet while the
 * WebView re-initialises. By rendering at the root via a portal pattern, we
 * keep children mounted across open/close — the WebView stays warm and
 * subsequent opens are instant.
 *
 * WHY NOT BottomSheetModal?
 * gorhom's BottomSheetModal unmounts children on dismiss, which defeats our
 * WebView pre-warming strategy. Instead we use the inline BottomSheet component
 * inside our own context-based portal, keeping content mounted at all times.
 *
 * WHY A PORTAL?
 * The NativeSheet is declared deep in the component tree (inside BibleReader),
 * but needs to overlay the entire screen (above tabs, nav bars, etc.). React
 * Native doesn't have `createPortal` like React DOM. Instead, we use a
 * context-based portal: NativeSheet registers its children with the provider
 * via context, and NativeSheetProvider renders them inside a BottomSheet at the
 * root of the app.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Platform, StyleSheet } from 'react-native'
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet'
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet'

// ---------------------------------------------------------------------------
// Context — connects NativeSheet (portal client) to NativeSheetProvider (host)
// ---------------------------------------------------------------------------

type PortalEntry = {
  content: React.ReactNode
  onClose: () => void
  open: boolean
}

type SheetContextValue = {
  register: (content: React.ReactNode, onClose: () => void, open: boolean) => void
  unregister: () => void
}

const SheetContext = createContext<SheetContextValue | null>(null)

function useSheetPortal() {
  const ctx = useContext(SheetContext)
  if (!ctx) throw new Error('Wrap your app root with <NativeSheetProvider>')
  return ctx
}

// ---------------------------------------------------------------------------
// NativeSheet — portal client (renders nothing, syncs children to provider)
// ---------------------------------------------------------------------------

type NativeSheetProps = {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

/**
 * Renders nothing locally. Instead, portals its children to the root-level
 * NativeSheetProvider overlay via React context — similar to React DOM's
 * `createPortal`, which doesn't exist in React Native.
 *
 * The useEffect without a dependency array runs after every render, keeping
 * the portaled content in sync with the latest children/props. This is
 * intentional — React elements are new objects each render, so a deps check
 * would fire every time anyway.
 */
export function NativeSheet({ isOpen, onClose, children }: NativeSheetProps) {
  const { register, unregister } = useSheetPortal()

  // Sync children, onClose, and open state to the provider on every render.
  useEffect(() => {
    if (Platform.OS === 'web') return
    register(children, onClose, isOpen)
  })

  // Clean up portal registration when this component unmounts.
  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web') unregister()
    }
  }, [unregister])

  return null
}

// ---------------------------------------------------------------------------
// NativeSheetProvider — portal host (renders BottomSheet at app root)
// ---------------------------------------------------------------------------

const renderBackdrop = (props: BottomSheetBackdropProps) => (
  <BottomSheetBackdrop
    {...props}
    pressBehavior="close"
    appearsOnIndex={0}
    disappearsOnIndex={-1}
  />
)

export function NativeSheetProvider({ children }: { children: React.ReactNode }) {
  const [entry, setEntry] = useState<PortalEntry | null>(null)
  const sheetRef = useRef<BottomSheet>(null)

  // Ref mirrors so callbacks captured in useMemo closures stay current.
  const entryRef = useRef(entry)
  entryRef.current = entry

  // Track whether we programmatically triggered a close so we don't double-fire onClose.
  const closingRef = useRef(false)

  const handleSheetChange = useCallback((index: number) => {
    // index -1 = fully closed. If user swiped/tapped backdrop to dismiss,
    // we need to notify the portal client.
    if (index === -1 && !closingRef.current) {
      entryRef.current?.onClose()
    }
    closingRef.current = false
  }, [])

  // Track previous open state to detect transitions.
  const wasOpenRef = useRef(false)

  // Drive BottomSheet imperatively when open state changes.
  useEffect(() => {
    const isOpen = entry?.open ?? false
    if (isOpen && !wasOpenRef.current) {
      sheetRef.current?.snapToIndex(0)
    } else if (!isOpen && wasOpenRef.current) {
      closingRef.current = true
      sheetRef.current?.close()
    }
    wasOpenRef.current = isOpen
  }, [entry?.open])

  // Stable context value — register/unregister never change identity, so
  // consumers (NativeSheet) don't re-render from context changes alone.
  const ctx = useMemo<SheetContextValue>(
    () => ({
      register: (content, onClose, open) => {
        setEntry({ content, onClose, open })
      },
      unregister: () => {
        setEntry(null)
        closingRef.current = true
        sheetRef.current?.close()
      },
    }),
    [],
  )

  // On web, DOM components render inline (no WebView), so the web SDK's own
  // Radix popover handles footnotes. We skip the sheet entirely.
  if (Platform.OS === 'web') {
    return <SheetContext.Provider value={ctx}>{children}</SheetContext.Provider>
  }

  return (
    <SheetContext.Provider value={ctx}>
      {children}

      <BottomSheet
        ref={sheetRef}
        index={-1}
        enablePanDownToClose
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        onChange={handleSheetChange}
        style={styles.sheet}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView>
          {entry?.content}
        </BottomSheetView>
      </BottomSheet>
    </SheetContext.Provider>
  )
}

const styles = StyleSheet.create({
  sheet: {
    zIndex: 1000,
  },
  handle: {
    backgroundColor: '#ccc',
  },
})
