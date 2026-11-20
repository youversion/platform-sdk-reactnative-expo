export type PlaylistVideoOutcome<Video> =
  | { readonly requestedId: string; readonly ok: true; readonly video: Video }
  | { readonly requestedId: string; readonly ok: false; readonly message: string }

export type PlaylistVideoFetch<Video> =
  | { readonly ok: true; readonly video: Video }
  | { readonly ok: false; readonly message: string }

export type OrderedPlaylistVideo<Video> = {
  readonly requestedId: string
  readonly video: Video
}

type TimedVideo = {
  readonly runtime?: number | null
}

type SpokenVideo = {
  readonly language_tag?: string | null
}

type PlaybackSource = {
  readonly format: string
  readonly url: string
}

type ThumbnailSize = {
  readonly width?: number | null
  readonly height?: number | null
}

/** Ids that still have no video, in playlist order, ignoring repeats. */
export function unresolvedPlaylistVideoIds<Video>(
  requestedIds: readonly string[],
  resolved: ReadonlyMap<string, Video>,
): readonly string[] {
  const pending: string[] = []
  const seen = new Set<string>()
  for (const requestedId of requestedIds) {
    if (seen.has(requestedId) || resolved.has(requestedId)) continue
    seen.add(requestedId)
    pending.push(requestedId)
  }
  return pending
}

/**
 * Fetches every id it is given and tags the outcome with that requested id.
 * The video record's own id is left untouched. One failure does not drop the others.
 */
export async function fetchPlaylistVideoOutcomes<Video>(
  requestedIds: readonly string[],
  fetchVideo: (requestedId: string) => Promise<PlaylistVideoFetch<Video>>,
): Promise<readonly PlaylistVideoOutcome<Video>[]> {
  const outcomes = await Promise.all(
    requestedIds.map(async (requestedId) => {
      try {
        const result = await fetchVideo(requestedId)
        if (result.ok) {
          const success: PlaylistVideoOutcome<Video> = {
            requestedId,
            ok: true,
            video: result.video,
          }
          return success
        }
        const failure: PlaylistVideoOutcome<Video> = {
          requestedId,
          ok: false,
          message: result.message,
        }
        return failure
      } catch (caught) {
        const failure: PlaylistVideoOutcome<Video> = {
          requestedId,
          ok: false,
          message: caught instanceof Error ? caught.message : 'Unable to load video',
        }
        return failure
      }
    }),
  )
  return outcomes
}

/**
 * Stores each success under the requested id.
 * A video that is already stored stays as it is.
 * A generation that is no longer current stores nothing.
 */
export function applyPlaylistVideoOutcomes<Video>(
  resolved: ReadonlyMap<string, Video>,
  outcomes: readonly PlaylistVideoOutcome<Video>[],
  requestGeneration: number,
  currentGeneration: number,
): ReadonlyMap<string, Video> | null {
  if (requestGeneration !== currentGeneration) return null
  const next = new Map(resolved)
  for (const outcome of outcomes) {
    if (!outcome.ok) continue
    if (next.has(outcome.requestedId)) continue
    next.set(outcome.requestedId, outcome.video)
  }
  return next
}

/** Playlist order, with gaps where a video has not loaded. Response ids are not the order. */
export function orderedPlaylistVideos<Video>(
  requestedIds: readonly string[],
  resolved: ReadonlyMap<string, Video>,
): readonly OrderedPlaylistVideo<Video>[] {
  const ordered: OrderedPlaylistVideo<Video>[] = []
  for (const requestedId of requestedIds) {
    const video = resolved.get(requestedId)
    if (video === undefined) continue
    ordered.push({ requestedId, video })
  }
  return ordered
}

export function firstPlaylistVideoError<Video>(
  outcomes: readonly PlaylistVideoOutcome<Video>[],
): string | null {
  for (const outcome of outcomes) {
    if (!outcome.ok) return outcome.message
  }
  return null
}

/**
 * Total runtime only when every requested video loaded and every runtime is a
 * real non-negative number. A partial list or a missing runtime has no total.
 */
export function playlistRuntimeSeconds(
  requestedIds: readonly string[],
  resolved: ReadonlyMap<string, TimedVideo>,
): number | null {
  if (requestedIds.length === 0) return null
  let total = 0
  const seen = new Set<string>()
  for (const requestedId of requestedIds) {
    if (seen.has(requestedId)) continue
    seen.add(requestedId)
    const video = resolved.get(requestedId)
    if (video === undefined) return null
    const runtime = video.runtime
    if (runtime === null || runtime === undefined) return null
    if (!Number.isFinite(runtime) || runtime < 0) return null
    total += runtime
  }
  return total
}

/** Language tags present on the videos that have loaded. Missing tags are skipped. */
export function playlistLanguageTags(
  requestedIds: readonly string[],
  resolved: ReadonlyMap<string, SpokenVideo>,
): readonly string[] {
  const tags = new Set<string>()
  for (const requestedId of requestedIds) {
    const tag = resolved.get(requestedId)?.language_tag
    if (tag === null || tag === undefined) continue
    const trimmed = tag.trim()
    if (trimmed === '') continue
    tags.add(trimmed)
  }
  return Array.from(tags).sort((left, right) => left.localeCompare(right))
}

export function formatLanguageList(labels: readonly string[]): string {
  if (labels.length === 0) return ''
  return new Intl.ListFormat(undefined, { type: 'conjunction' }).format(labels)
}

export function languageName(tag: string): string {
  try {
    const name = new Intl.DisplayNames(undefined, { type: 'language' }).of(tag)
    if (name === undefined || name === '') return tag
    return name
  } catch {
    return tag
  }
}

/** HLS when present, otherwise MP4. Other formats and blank URLs are skipped. */
export function playbackSourceUrl(sources: readonly PlaybackSource[]): string | null {
  const hls = sources.find((source) => source.format === 'hls' && source.url.trim() !== '')
  if (hls !== undefined) return hls.url
  const mp4 = sources.find((source) => source.format === 'mp4' && source.url.trim() !== '')
  if (mp4 !== undefined) return mp4.url
  return null
}

/** Thumbnail width/height when both are usable. Otherwise portrait is 9:16 and everything else is 16:9. */
export function videoDisplayAspect(
  thumbnail: ThumbnailSize | null | undefined,
  orientation: 'landscape' | 'portrait' | null | undefined,
): number {
  const width = thumbnail?.width
  const height = thumbnail?.height
  if (
    width !== null &&
    width !== undefined &&
    height !== null &&
    height !== undefined &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    return width / height
  }
  if (orientation === 'portrait') return 9 / 16
  return 16 / 9
}

export function formatRuntime(seconds: number, forceHours: boolean): string {
  if (!Number.isFinite(seconds) || seconds < 0) return ''
  const total = Math.floor(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const secondText = String(secs).padStart(2, '0')
  if (forceHours || hours > 0) {
    const minuteText = String(minutes).padStart(2, '0')
    return `${hours}:${minuteText}:${secondText}`
  }
  return `${minutes}:${secondText}`
}

export function visibleText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  if (trimmed === '') return null
  return trimmed
}

export function collectionsByTitle<Collection extends { readonly title: string }>(
  collections: readonly Collection[],
): readonly Collection[] {
  return collections.slice().sort((left, right) => left.title.localeCompare(right.title))
}

export type ListedCollection = {
  readonly id: string
  readonly playlistId: number
  readonly title: string
  readonly description: string | null
  readonly total: number | null
  readonly videoIds: readonly string[]
}

type PlaylistRecord = {
  readonly id?: number
  readonly title?: string
  readonly description?: string | null
  readonly total?: number
  readonly videos?: readonly string[]
}

/** A playlist the library can open. Rows without an id or a title are dropped. */
export function listedCollection(playlist: PlaylistRecord): ListedCollection | null {
  if (playlist.id === undefined || !Number.isInteger(playlist.id)) return null
  const title = playlist.title?.trim()
  if (title === undefined || title === '') return null
  return {
    id: String(playlist.id),
    playlistId: playlist.id,
    title,
    description: playlist.description ?? null,
    total: playlist.total ?? null,
    videoIds: playlist.videos ?? [],
  }
}

export function collectionShareText(
  title: string | null,
  shareUrls: readonly (string | null | undefined)[],
): string {
  const lines: string[] = []
  if (title !== null && title.trim() !== '') lines.push(title.trim())
  for (const url of shareUrls) {
    if (url === null || url === undefined) continue
    if (url.trim() === '') continue
    lines.push(url)
  }
  return lines.join('\n')
}
