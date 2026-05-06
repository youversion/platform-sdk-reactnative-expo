import { useRef } from 'react'
import { View } from 'react-native'
import {
  Host,
  ModalBottomSheet,
  RNHostView,
} from '@expo/ui/jetpack-compose'
import type { ModalBottomSheetRef } from '@expo/ui/jetpack-compose'

type NativeSheetProps = {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function NativeSheet({ isOpen, onClose, children }: NativeSheetProps) {
  const sheetRef = useRef<ModalBottomSheetRef>(null)

  if (!isOpen) return null

  return (
    <Host matchContents>
      <ModalBottomSheet ref={sheetRef} onDismissRequest={onClose}>
        <RNHostView matchContents>
          <View>{children}</View>
        </RNHostView>
      </ModalBottomSheet>
    </Host>
  )
}
