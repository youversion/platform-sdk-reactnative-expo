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

export function NativeSheetProvider({ children }: { children: React.ReactNode }) {
  const [entry, setEntry] = useState<PortalEntry | null>(null)
  const { height } = useWindowDimensions()
  const translateY = useRef(new Animated.Value(height)).current
  const backdropOpacity = useRef(new Animated.Value(0)).current

  const isOpen = entry?.open ?? false

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

  const handleBackdropPress = useCallback(() => {
    entry?.onClose()
  }, [entry])

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

  if (Platform.OS === 'web') {
    return <SheetContext.Provider value={ctx}>{children}</SheetContext.Provider>
  }

  return (
    <SheetContext.Provider value={ctx}>
      {children}
      {entry && (
        <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? 'auto' : 'none'}>
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
          </Animated.View>
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            <View style={styles.handle} />
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
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#ccc',
    marginTop: 8,
    marginBottom: 4,
  },
})
