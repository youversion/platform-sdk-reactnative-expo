import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

export type WidgetPreviewWrapperProps = {
  title: string
  children: ReactNode
}

export function WidgetPreviewWrapper({ title, children }: WidgetPreviewWrapperProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.previewLabel}>{title}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  previewLabel: {
    padding: 16,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
})
