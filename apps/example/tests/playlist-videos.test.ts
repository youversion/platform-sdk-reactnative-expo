import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  applyPlaylistVideoOutcomes,
  fetchPlaylistVideoOutcomes,
  firstPlaylistVideoError,
  formatRuntime,
  orderedPlaylistVideos,
  playbackSourceUrl,
  playlistLanguageTags,
  playlistRuntimeSeconds,
  unresolvedPlaylistVideoIds,
  videoDisplayAspect,
} from '../src/lib/playlist-videos.ts'

type LoadedVideo = {
  readonly id: string
  readonly runtime: number | null
  readonly language_tag: string | null
}

const video = (id: string, runtime: number | null, languageTag: string | null): LoadedVideo => ({
  id,
  runtime,
  language_tag: languageTag,
})

describe('playlist video metadata', () => {
  it('keeps loaded videos visible, skips them on retry, and fills the gap in playlist order', async () => {
    const requestedIds = ['verse-a', 'verse-b', 'verse-c']
    const calls: string[] = []
    let resolved = new Map<string, LoadedVideo>([
      ['verse-a', video('response-a', 30, 'en')],
    ])

    const firstPending = unresolvedPlaylistVideoIds(requestedIds, resolved)
    const firstOutcomes = await fetchPlaylistVideoOutcomes(firstPending, async (requestedId) => {
      calls.push(requestedId)
      if (requestedId === 'verse-b') return { ok: false, message: 'Metadata unavailable' }
      return { ok: true, video: video('response-c', 90, 'es') }
    })
    const afterFailure = applyPlaylistVideoOutcomes(resolved, firstOutcomes, 1, 1)
    assert.ok(afterFailure)
    resolved = afterFailure

    assert.deepEqual(
      orderedPlaylistVideos(requestedIds, resolved).map((item) => item.video.id),
      ['response-a', 'response-c'],
    )
    assert.deepEqual(
      orderedPlaylistVideos(requestedIds, resolved).map((item) => item.requestedId),
      ['verse-a', 'verse-c'],
    )
    assert.equal(firstPlaylistVideoError(firstOutcomes), 'Metadata unavailable')
    assert.deepEqual(calls, ['verse-b', 'verse-c'])

    const retryPending = unresolvedPlaylistVideoIds(requestedIds, resolved)
    assert.deepEqual(retryPending, ['verse-b'])
    const retryOutcomes = await fetchPlaylistVideoOutcomes(retryPending, async (requestedId) => {
      calls.push(requestedId)
      return { ok: true, video: video('response-b', 45, 'en') }
    })
    const afterRetry = applyPlaylistVideoOutcomes(resolved, retryOutcomes, 2, 2)
    assert.ok(afterRetry)
    resolved = afterRetry

    assert.deepEqual(
      orderedPlaylistVideos(requestedIds, resolved).map((item) => ({
        requestedId: item.requestedId,
        responseId: item.video.id,
      })),
      [
        { requestedId: 'verse-a', responseId: 'response-a' },
        { requestedId: 'verse-b', responseId: 'response-b' },
        { requestedId: 'verse-c', responseId: 'response-c' },
      ],
    )
    assert.deepEqual(calls, ['verse-b', 'verse-c', 'verse-b'])
    assert.equal(resolved.get('verse-a'), afterFailure.get('verse-a'))
    assert.equal(resolved.get('verse-c'), afterFailure.get('verse-c'))
  })

  it('ignores a completion from an older load', async () => {
    const requestedIds = ['verse-a', 'verse-b']
    const resolved = new Map<string, LoadedVideo>([['verse-a', video('response-a', 10, 'en')]])
    let currentGeneration = 1
    const outcomes = await fetchPlaylistVideoOutcomes(['verse-b'], async () => {
      currentGeneration = 2
      return { ok: true, video: video('response-b', 10, 'en') }
    })
    const applied = applyPlaylistVideoOutcomes(resolved, outcomes, 1, currentGeneration)

    assert.equal(applied, null)
    assert.deepEqual(
      orderedPlaylistVideos(requestedIds, resolved).map((item) => item.requestedId),
      ['verse-a'],
    )
  })

  it('leaves an already loaded video in place when a later success repeats its requested id', () => {
    const original = video('response-a', 10, 'en')
    const resolved = new Map<string, LoadedVideo>([['verse-a', original]])
    const next = applyPlaylistVideoOutcomes(
      resolved,
      [{ requestedId: 'verse-a', ok: true, video: video('other-response', 99, 'fr') }],
      1,
      1,
    )

    assert.ok(next)
    assert.equal(next.get('verse-a'), original)
  })

  it('hides the total runtime until every video has loaded with a runtime', () => {
    const requestedIds = ['verse-a', 'verse-b']
    const partial = new Map<string, LoadedVideo>([['verse-a', video('response-a', 30, 'en')]])
    assert.equal(playlistRuntimeSeconds(requestedIds, partial), null)

    const missingRuntime = new Map<string, LoadedVideo>([
      ['verse-a', video('response-a', 30, 'en')],
      ['verse-b', video('response-b', null, 'en')],
    ])
    assert.equal(playlistRuntimeSeconds(requestedIds, missingRuntime), null)

    const complete = new Map<string, LoadedVideo>([
      ['verse-a', video('response-a', 30, 'en')],
      ['verse-b', video('response-b', 45, 'es')],
    ])
    assert.equal(playlistRuntimeSeconds(requestedIds, complete), 75)
    assert.deepEqual(playlistLanguageTags(requestedIds, partial), ['en'])
    assert.deepEqual(playlistLanguageTags(requestedIds, complete), ['en', 'es'])
  })
})

describe('video playback details', () => {
  it('uses the full HLS url, then MP4, and plays nothing when those sources are empty', () => {
    assert.equal(
      playbackSourceUrl([
        { format: 'webm', url: 'https://cdn.example/preview.webm' },
        { format: 'mp4', url: 'https://cdn.example/full.mp4' },
        { format: 'hls', url: 'https://cdn.example/full.m3u8' },
      ]),
      'https://cdn.example/full.m3u8',
    )
    assert.equal(
      playbackSourceUrl([{ format: 'mp4', url: 'https://cdn.example/full.mp4' }]),
      'https://cdn.example/full.mp4',
    )
    assert.equal(playbackSourceUrl([]), null)
    assert.equal(playbackSourceUrl([{ format: 'hls', url: '   ' }]), null)
    assert.equal(playbackSourceUrl([{ format: 'mp3', url: 'https://cdn.example/audio.mp3' }]), null)
  })

  it('falls back when the thumbnail aspect ratio is missing or unusable', () => {
    assert.equal(videoDisplayAspect({ width: 1920, height: 1080 }, 'landscape'), 1920 / 1080)
    assert.equal(videoDisplayAspect({ width: 0, height: 1080 }, 'portrait'), 9 / 16)
    assert.equal(videoDisplayAspect({ width: -1, height: 10 }, null), 16 / 9)
    assert.equal(videoDisplayAspect(null, 'portrait'), 9 / 16)
    assert.equal(videoDisplayAspect(undefined, null), 16 / 9)
  })

  it('formats a short runtime without hours and a long one with hours', () => {
    assert.equal(formatRuntime(65, false), '1:05')
    assert.equal(formatRuntime(3661, false), '1:01:01')
    assert.equal(formatRuntime(65, true), '0:01:05')
    assert.equal(formatRuntime(Number.NaN, false), '')
  })
})
