/**
 * Portal-based bottom sheet rendered at the app root.
 *
 * WHY NOT React Native's `<Modal>`?
 * Modal unmounts its children when `visible={false}`. Our sheet content is a
 * DOM component (Expo "use dom" — renders in a WebView). WebViews take ~500ms+
 * to cold-start, so every open/close cycle would flash a blank sheet while the
 * WebView re-initialises. By rendering at the root via a portal pattern, we
 * keep children mounted across open/close — the WebView stays warm and
 * subsequent opens are instant.
 *
 * This is the same strategy Shopify uses in their MobileBridge architecture:
 * keep WebViews alive and reuse them instead of destroying/recreating.
 * See: https://shopify.engineering/mobilebridge-native-webviews
 *
 * WHY A PORTAL?
 * The NativeSheet is declared deep in the component tree (inside BibleReader),
 * but needs to overlay the entire screen (above tabs, nav bars, etc.). React
 * Native doesn't have `createPortal` like React DOM. Instead, we use a
 * context-based portal: NativeSheet registers its children with this provider
 * via context, and the provider renders them in an absolute-positioned overlay
 * at the root of the app. This is the same pattern used by @gorhom/bottom-sheet
 * (BottomSheetModalProvider) and react-native-portal.
 *
 * WHY PanResponder FOR DISMISS?
 * The handle area uses PanResponder to track vertical drag gestures. If the
 * user drags down past DISMISS_THRESHOLD (80px), we call onClose. Otherwise
 * the sheet snaps back. This mimics native iOS/Android sheet dismiss behaviour
 * without requiring react-native-gesture-handler as a dependency.
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
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native'

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

export function useSheetPortal() {
  const ctx = useContext(SheetContext)
  if (!ctx) throw new Error('Wrap your app root with <NativeSheetProvider>')
  return ctx
}

const ANIM_MS = 300
const DISMISS_THRESHOLD = 80

export function NativeSheetProvider({ children }: { children: React.ReactNode }) {
  const [entry, setEntry] = useState<PortalEntry | null>(null)
  const { height } = useWindowDimensions()
  const translateY = useRef(new Animated.Value(height)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current

  // Ref mirror of entry so PanResponder callbacks (which are captured in a
  // ref and never re-created) can access the latest onClose without going stale.
  const entryRef = useRef(entry)
  entryRef.current = entry

  const isOpen = entry?.open ?? false

  // Animate sheet and backdrop in/out when open state changes.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: isOpen ? 0 : height,
        duration: ANIM_MS,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: isOpen ? 1 : 0,
        duration: ANIM_MS,
        useNativeDriver: true,
      }),
    ]).start()
  }, [isOpen, height, translateY, backdropOpacity])

  // PanResponder lives in a ref so it's created once and never re-allocated.
  // It drives translateY and backdropOpacity directly for 60fps drag tracking,
  // then either dismisses or snaps back on release.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => {
        // Only allow downward drag (positive dy).
        if (g.dy > 0) {
          translateY.setValue(g.dy)
          backdropOpacity.setValue(1 - Math.min(g.dy / 300, 1))
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_THRESHOLD) {
          entryRef.current?.onClose()
        } else {
          // Snap back to open position.
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(backdropOpacity, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start()
        }
      },
    }),
  ).current

  const handleBackdropPress = useCallback(() => {
    entry?.onClose()
  }, [entry])

  // Stable context value — register/unregister never change identity, so
  // consumers (NativeSheet) don't re-render from context changes alone.
  const ctx = useMemo<SheetContextValue>(
    () => ({
      register: (content, onClose, open) => {
        setEntry({ content, onClose, open })
      },
      unregister: () => {
        setEntry(null)
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

      {/* Root-level overlay — absolutely positioned above all app content. */}
      {entry && (
        <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
          {/* Semi-transparent backdrop — tap to dismiss. */}
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
          </Animated.View>

          {/* Sheet container — slides up from bottom via translateY. */}
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            {/* Drag handle — PanResponder target for swipe-to-dismiss. */}
            <View style={styles.handleArea} {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>

            {/* Portaled content from NativeSheet (e.g., FootnoteContent DOM component). */}
            {entry.content}
          </Animated.View>
        </View>
      )}
    </SheetContext.Provider>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  handleArea: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ccc',
  },
})
