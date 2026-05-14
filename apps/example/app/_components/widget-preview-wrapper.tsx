import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

export type WidgetPreviewWrapperProps = {
  title: string
  children: ReactNode
}

export function WidgetPreviewWrapper({ title, children }: WidgetPreviewWrapperProps) {
  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <Text style={styles.previewLabel}>{title}</Text>
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
  },
  preview: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewLabel: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    opacity: 0.7,
  },
  content: {
    flex: 1,
    padding: 16,
  },
})
