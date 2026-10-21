import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { StyleSheet, View } from 'react-native'

export function ChromeFrame({ children }: { children: ReactNode }) {
  return createPortal(<View style={styles.frame}>{children}</View>, document.body)
}

const styles = StyleSheet.create({
  frame: {
    // SAFETY: react-native-web paints `fixed`. The RN style union only lists absolute.
    position: 'fixed' as 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
})
