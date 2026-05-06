import { BottomSheet, Host } from '@expo/ui/swift-ui'

type NativeSheetProps = {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function NativeSheet({ isOpen, onClose, children }: NativeSheetProps) {
  return (
    <Host style={{ position: 'absolute', width: '100%' }}>
      <BottomSheet
        isPresented={isOpen}
        onIsPresentedChange={(presented: boolean) => {
          if (!presented) onClose()
        }}
      >
        {children}
      </BottomSheet>
    </Host>
  )
}
