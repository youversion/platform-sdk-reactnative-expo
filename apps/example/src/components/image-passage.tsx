import type { YouVersionImage } from '@youversion/platform-react-native-expo-core'
import { biblePassageAnchorFromPassageId } from '@youversion/platform-react-native-expo-core'
import { BibleTextView, useTokens } from '@youversion/platform-react-native-expo-ui'
import { Pressable, StyleSheet, Text, View } from 'react-native'

type ImagePassageProps = {
  image: YouVersionImage
  versionId: number
  onRead: () => void
}

export function ImagePassage({ image, versionId, onRead }: ImagePassageProps) {
  const tokens = useTokens()
  const anchor = biblePassageAnchorFromPassageId(image.passage_id, versionId)

  return (
    <View style={styles.wrap}>
      <Text style={[styles.caption, { color: tokens.mutedForeground }]}>Verses in this image</Text>
      <BibleTextView reference={image.passage_id} versionId={versionId} />
      {image.attribution === '' ? null : (
        <Text style={[styles.caption, { color: tokens.mutedForeground }]}>{image.attribution}</Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: anchor === null }}
        disabled={anchor === null}
        onPress={onRead}
        style={[
          styles.read,
          {
            backgroundColor: tokens.primary,
            borderRadius: tokens.radius.full,
            opacity: anchor === null ? 0.5 : 1,
          },
        ]}
      >
        <Text style={[styles.readLabel, { color: tokens.primaryForeground }]}>Read in Bible</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 16,
  },
  caption: {
    fontSize: 13,
  },
  read: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  readLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
})
