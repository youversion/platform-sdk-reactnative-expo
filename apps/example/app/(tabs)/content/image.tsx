import { useImages, type YouVersionImage } from '@youversion/platform-react-native-expo-core'
import { useTokens } from '@youversion/platform-react-native-expo-ui'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ImagePassage } from '../../../src/components/image-passage'
import { ImageViewer } from '../../../src/components/image-viewer'
import { VerseImageStack } from '../../../src/components/verse-image-stack'
import { formatPassageLabel } from '../../../src/lib/passage-label'
import { openedImage } from '../../../src/lib/opened-images'
import { openPassageInReader, useReaderVersionId } from '../../../src/lib/reader-session'
import { shareImageUrl } from '../../../src/lib/share-image'
import { useBookTitles } from '../../../src/lib/use-book-titles'
import { useContentLanguage } from '../../../src/lib/use-content-language'
import { usePassageImages } from '../../../src/lib/use-passage-images'

function routeId(value: string | string[] | undefined): string | null {
  if (value === undefined) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export default function ContentImageScreen() {
  const tokens = useTokens()
  const { bottom } = useSafeAreaInsets()
  const params = useLocalSearchParams<{ id?: string | string[] }>()
  const id = routeId(params.id)
  const versionId = useReaderVersionId()
  const language = useContentLanguage()
  const titles = useBookTitles(versionId)
  const images = useImages()
  const stored = id === null ? undefined : openedImage(id)
  const [fetched, setFetched] = useState<YouVersionImage | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [selected, setSelected] = useState<YouVersionImage | null>(null)
  const [viewer, setViewer] = useState<YouVersionImage | null>(null)

  useEffect(() => {
    setFetched(null)
    setFetchError(null)
    setSelected(null)
    setViewer(null)
    if (id === null || openedImage(id) !== undefined) return
    let current = true
    setFetching(true)
    void images.get(id).then((result) => {
      if (!current) return
      setFetching(false)
      if (result.ok) setFetched(result.value)
      else setFetchError(result.error.message)
    })
    return () => {
      current = false
    }
  }, [id, images, reloadKey])

  const primary = stored ?? (fetched?.id === id ? fetched : null)
  const passage = usePassageImages(primary, language)
  const shown = useMemo(() => {
    if (passage.list.items.length > 0) return passage.list.items
    if (primary === null) return []
    return [primary]
  }, [passage.list.items, primary])
  const current = selected ?? shown[0] ?? null
  const label = current === null ? '' : formatPassageLabel(current.passage_id, titles)

  const read = useCallback(
    (image: YouVersionImage) => {
      const opened = openPassageInReader(image.passage_id, versionId)
      if (!opened) return
      setViewer(null)
      router.navigate('/')
    },
    [versionId],
  )

  const onSelectionChange = useCallback((image: YouVersionImage) => {
    setSelected((previous) => (previous?.id === image.id ? previous : image))
  }, [])

  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityLabel="Share image"
              accessibilityRole="button"
              disabled={current === null}
              onPress={() => {
                if (current === null) return
                void shareImageUrl(current.image_url)
              }}
              style={styles.share}
            >
              <Text
                style={{ color: current === null ? tokens.mutedForeground : tokens.foreground }}
              >
                Share
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + 24 }]}>
        {fetching ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
        {fetchError === null ? null : (
          <View style={styles.errorBlock}>
            <Text style={{ color: tokens.destructive }}>{fetchError}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setReloadKey((key) => key + 1)}
              style={[
                styles.retry,
                { borderColor: tokens.border, borderRadius: tokens.radius.full },
              ]}
            >
              <Text style={{ color: tokens.foreground }}>Retry</Text>
            </Pressable>
          </View>
        )}
        {current === null ? null : (
          <>
            <Text style={[styles.eyebrow, { color: tokens.mutedForeground }]}>Verse images</Text>
            <Text style={[styles.title, { color: tokens.foreground }]}>{label}</Text>
            <VerseImageStack
              images={shown}
              onOpen={setViewer}
              onSelectionChange={onSelectionChange}
            />
            {passage.error === null ? null : (
              <View style={styles.errorBlock}>
                <Text style={{ color: tokens.destructive }}>{passage.error}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={passage.retry}
                  style={[
                    styles.retry,
                    { borderColor: tokens.border, borderRadius: tokens.radius.full },
                  ]}
                >
                  <Text style={{ color: tokens.foreground }}>Retry</Text>
                </Pressable>
              </View>
            )}
            {passage.loading ? <ActivityIndicator color={tokens.mutedForeground} /> : null}
            <ImagePassage image={current} onRead={() => read(current)} versionId={versionId} />
          </>
        )}
      </ScrollView>
      <ImageViewer
        image={viewer}
        label={viewer === null ? '' : formatPassageLabel(viewer.passage_id, titles)}
        onClose={() => setViewer(null)}
        onRead={() => {
          if (viewer === null) return
          read(viewer)
        }}
        versionId={versionId}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  errorBlock: {
    gap: 8,
  },
  retry: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  share: {
    paddingHorizontal: 8,
  },
})
