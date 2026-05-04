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

  // Sync children, onClose, and open state to the root-level provider
  // on every render so the portaled content stays fresh.
  useEffect(() => {
    if (Platform.OS === 'web') return
    register(children, onClose, isOpen)
  })

  // Clean up when this component unmounts
  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web') unregister()
    }
  }, [unregister])

  return null
}
