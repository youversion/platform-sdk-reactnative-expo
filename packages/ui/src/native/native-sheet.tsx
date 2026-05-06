import { Modal, Pressable, StyleSheet, View, Platform } from 'react-native'

type NativeSheetProps = {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export function NativeSheet({ isOpen, onClose, children }: NativeSheetProps) {
  if (Platform.OS === 'web') return null

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.handle} />
        <Pressable style={styles.closeArea} onPress={onClose} />
        {children}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  closeArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 16,
  },
})
