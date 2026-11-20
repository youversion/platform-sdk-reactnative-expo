import type { YouVersionImage } from '@youversion/platform-react-native-expo-core'
import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { shareImageUrl } from '../_lib/share-image'
import { ImagePassage } from './image-passage'
import { VerseImage } from './verse-image'

type ImageViewerProps = {
  image: YouVersionImage | null
  label: string
  versionId: number
  onClose: () => void
  onRead: () => void
}

export function ImageViewer({ image, label, versionId, onClose, onRead }: ImageViewerProps) {
  const tokens = useTokens()
  const insets = useSafeAreaInsets()

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="fullScreen"
      visible={image !== null}
    >
      {image === null ? null : (
        <View
          style={[styles.screen, { backgroundColor: tokens.background, paddingTop: insets.top }]}
        >
          <View style={styles.bar}>
            <Pressable
              accessibilityLabel="Close image"
              accessibilityRole="button"
              onPress={onClose}
            >
              <Text style={[styles.action, { color: tokens.foreground }]}>Close</Text>
            </Pressable>
            <View style={styles.titles}>
              <Text style={[styles.title, { color: tokens.foreground }]}>Verse image</Text>
              <Text numberOfLines={1} style={[styles.subtitle, { color: tokens.mutedForeground }]}>
                {label}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Share image"
              accessibilityRole="button"
              onPress={() => {
                void shareImageUrl(image.image_url)
              }}
            >
              <Text style={[styles.action, { color: tokens.foreground }]}>Share</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          >
            <VerseImage frame="natural" image={image} presentation="standard" size="full" />
            <ImagePassage image={image} onRead={onRead} versionId={versionId} />
          </ScrollView>
        </View>
      )}
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  titles: {
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
  },
  action: {
    fontSize: 16,
  },
  content: {
    gap: 20,
    padding: 20,
  },
})
