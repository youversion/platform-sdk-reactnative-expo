import type { YouVersionImage } from '@youversion/platform-react-native-expo-core'
import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { useState } from 'react'
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native'

import { imageAspect, renditionUrl } from '../lib/image-library'

type VerseImageProps = {
  image: YouVersionImage
  presentation: 'standard' | 'decorative'
  frame: 'square' | 'natural'
  size: 'thumb' | 'card' | 'full'
}

export function VerseImage({ image, presentation, frame, size }: VerseImageProps) {
  const tokens = useTokens()
  const [attempt, setAttempt] = useState(0)
  const uri = renditionUrl(image.image_url, size)
  const [shownUri, setShownUri] = useState(uri)
  const [phase, setPhase] = useState<'loading' | 'loaded' | 'failed'>('loading')
  if (shownUri !== uri) {
    setShownUri(uri)
    setPhase('loading')
  }
  const decorative = presentation === 'decorative'

  function retry() {
    setAttempt((value) => value + 1)
    setPhase('loading')
  }

  const aspect = frame === 'square' ? 1 : imageAspect(image.aspect_ratio)

  return (
    <View
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      pointerEvents={decorative ? 'none' : 'auto'}
      style={[
        styles.frame,
        {
          aspectRatio: aspect,
          backgroundColor: tokens.muted,
          borderRadius: tokens.radius.surface,
        },
      ]}
    >
      <Image
        key={`${image.id}-${attempt}`}
        accessibilityLabel={decorative ? undefined : image.passage_id}
        onError={() => setPhase('failed')}
        onLoad={() => setPhase('loaded')}
        resizeMode={frame === 'square' ? 'cover' : 'contain'}
        source={{ uri }}
        style={styles.fill}
      />
      {decorative || phase === 'loaded' ? null : (
        <View style={[styles.overlay, { backgroundColor: tokens.muted }]}>
          {phase === 'failed' ? (
            <>
              <Text style={[styles.failed, { color: tokens.mutedForeground }]}>
                Image unavailable
              </Text>
              <Pressable
                accessibilityLabel="Retry image"
                accessibilityRole="button"
                onPress={retry}
                style={[
                  styles.retry,
                  { borderColor: tokens.border, borderRadius: tokens.radius.full },
                ]}
              >
                <Text style={{ color: tokens.foreground }}>Retry</Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={tokens.mutedForeground} />
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
    width: '100%',
  },
  overlay: {
    alignItems: 'center',
    bottom: 0,
    gap: 12,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  failed: {
    fontSize: 15,
    textAlign: 'center',
  },
  retry: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
})
