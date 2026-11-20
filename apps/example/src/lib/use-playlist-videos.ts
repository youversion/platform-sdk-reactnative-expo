import { useCallback, useEffect, useRef, useState } from 'react'
import { useVideos, type ContentLibraryVideo } from '@youversion/platform-react-native-expo-core'

import { useContentLanguage } from './use-content-language'
import {
  applyPlaylistVideoOutcomes,
  fetchPlaylistVideoOutcomes,
  firstPlaylistVideoError,
  orderedPlaylistVideos,
  unresolvedPlaylistVideoIds,
  type OrderedPlaylistVideo,
  type PlaylistVideoFetch,
} from './playlist-videos'

export type PlaylistVideos = {
  videos: readonly OrderedPlaylistVideo<ContentLibraryVideo>[]
  error: string | null
  loading: boolean
  retry: () => void
}

export function usePlaylistVideos(videoIds: readonly string[]): PlaylistVideos {
  const videosApi = useVideos()
  const language = useContentLanguage()
  const [resolved, setResolved] = useState<ReadonlyMap<string, ContentLibraryVideo>>(
    () => new Map(),
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(videoIds.length > 0)
  const [reloadKey, setReloadKey] = useState(0)
  const generation = useRef(0)
  const resolvedRef = useRef(resolved)
  const apiRef = useRef(videosApi)
  const languageRef = useRef(language)

  resolvedRef.current = resolved
  apiRef.current = videosApi
  languageRef.current = language

  useEffect(() => {
    const requestGeneration = ++generation.current
    const pending = unresolvedPlaylistVideoIds(videoIds, resolvedRef.current)
    if (pending.length === 0) {
      setLoading(false)
      setError(null)
      return
    }

    let alive = true
    setLoading(true)
    setError(null)
    void fetchPlaylistVideoOutcomes(pending, async (requestedId) => {
      const result = await apiRef.current.get(requestedId, {
        acceptLanguage: languageRef.current,
        thumbnailSize: 'card',
      })
      if (result.ok) {
        const loaded: PlaylistVideoFetch<ContentLibraryVideo> = {
          ok: true,
          video: result.value,
        }
        return loaded
      }
      const failed: PlaylistVideoFetch<ContentLibraryVideo> = {
        ok: false,
        message: result.error.message,
      }
      return failed
    })
      .then((outcomes) => {
        if (!alive) return
        const next = applyPlaylistVideoOutcomes(
          resolvedRef.current,
          outcomes,
          requestGeneration,
          generation.current,
        )
        if (next === null) return
        resolvedRef.current = next
        setResolved(next)
        setError(firstPlaylistVideoError(outcomes))
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        if (generation.current !== requestGeneration) return
        setError('Unable to load videos')
        setLoading(false)
      })

    return () => {
      alive = false
      generation.current += 1
    }
  }, [videoIds, reloadKey])

  const retry = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [])

  return {
    videos: orderedPlaylistVideos(videoIds, resolved),
    error,
    loading,
    retry,
  }
}
