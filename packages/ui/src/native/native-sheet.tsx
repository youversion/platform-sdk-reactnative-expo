/**
 * Portal client for NativeSheetProvider.
 *
 * This component renders nothing itself. Instead, it "portals" its children
 * to the root-level NativeSheetProvider overlay via React context. This is
 * similar to React DOM's `createPortal`, which doesn't exist in React Native.
 *
 * The useEffect without a dependency array runs after every render, which
 * keeps the portaled content in sync with the latest children/props. This is
 * intentional — the parent (e.g., BibleReader) may update footnoteData or
 * theme, and the portaled content needs to reflect those changes immediately.
 *
 * See native-sheet-provider.tsx for why we use a portal instead of RN Modal.
 */

import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useSheetPortal } from './native-sheet-provider'

type NativeSheetProps = {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function NativeSheet({ isOpen, onClose, children }: NativeSheetProps) {
  const { register, unregister } = useSheetPortal()

  // Sync children, onClose, and open state to the root-level provider on
  // every render so the portaled content stays fresh. No dependency array
  // is intentional — React elements are new objects each render, so a deps
  // check would fire every time anyway.
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

  // Renders nothing locally — all visual output is in the provider's overlay.
  return null
}
