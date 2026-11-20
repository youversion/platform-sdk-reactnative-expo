// INTERIM (YPE-6577): replaced by @youversion/platform-core once platform-sdk-react#488 ships. Delete this file when adopting it.

import * as z from 'zod/mini'

import { VideoIdSchema } from './video-id'

/** A playable video or audio source. */
export const VideoPlaybackSourceSchema = z.object({
  url: z.string(),
  format: z.enum(['hls', 'webm', 'mp4', 'mp3']),
})

export type VideoPlaybackSource = Readonly<z.infer<typeof VideoPlaybackSourceSchema>>

export const VideoThumbnailSchema = z.object({
  url: z.optional(z.nullable(z.url())),
  width: z.optional(z.nullable(z.int())),
  height: z.optional(z.nullable(z.int())),
})

export type VideoThumbnail = Readonly<z.infer<typeof VideoThumbnailSchema>>

/**
 * Full Content Library video returned by video detail and dedicated search.
 * `playback_preview_sources` can 404 when played (YPE-6537). That failure is
 * separate from `playback_sources`; this model keeps both lists as returned.
 */
export const ContentLibraryVideoSchema = z.object({
  id: VideoIdSchema,
  title: z.optional(z.nullable(z.string())),
  description: z.optional(z.nullable(z.string())),
  passage_id: z.optional(z.nullable(z.string())),
  language_tag: z.optional(z.nullable(z.string())),
  runtime: z.optional(z.nullable(z.int())),
  orientation: z.optional(z.nullable(z.enum(['landscape', 'portrait']))),
  thumbnail: z.optional(z.nullable(VideoThumbnailSchema)),
  playback_sources: z.array(VideoPlaybackSourceSchema),
  playback_preview_sources: z.array(VideoPlaybackSourceSchema),
  share_url: z.optional(z.nullable(z.string())),
})

export type ContentLibraryVideo = Readonly<z.infer<typeof ContentLibraryVideoSchema>>

export const VideoThumbnailSizeSchema = z.enum(['thumb', 'card', 'full'])

export type VideoThumbnailSize = z.infer<typeof VideoThumbnailSizeSchema>

export const GetVideoOptionsSchema = z.object({
  acceptLanguage: z.optional(z.string().check(z.minLength(1))),
  thumbnailSize: z.optional(VideoThumbnailSizeSchema),
})

export type GetVideoOptions = z.infer<typeof GetVideoOptionsSchema>

const PLAYLIST_ID_ERROR = 'Playlist ID must be a 32-bit integer'

export const VideoPlaylistIdSchema = z
  .int({ error: PLAYLIST_ID_ERROR })
  .check(z.gte(-2_147_483_648, PLAYLIST_ID_ERROR), z.lte(2_147_483_647, PLAYLIST_ID_ERROR))

const VideoPlaylistFields = {
  id: VideoPlaylistIdSchema,
  title: z.string(),
  description: z.nullable(z.string()),
  type: z.string(),
  total: z.int(),
  videos: z.array(VideoIdSchema),
}

export const VideoPlaylistFullSchema = z.object(VideoPlaylistFields)

/** One playlist model. Collection field selection may omit any field. */
export const VideoPlaylistSchema = z.object({
  id: z.optional(VideoPlaylistFields.id),
  title: z.optional(VideoPlaylistFields.title),
  description: z.optional(VideoPlaylistFields.description),
  type: z.optional(VideoPlaylistFields.type),
  total: z.optional(VideoPlaylistFields.total),
  videos: z.optional(VideoPlaylistFields.videos),
})

export type VideoPlaylist = Readonly<z.infer<typeof VideoPlaylistSchema>>

export const VideoPlaylistFieldSchema = z.enum([
  'id',
  'title',
  'description',
  'type',
  'total',
  'videos',
])

export type VideoPlaylistField = z.infer<typeof VideoPlaylistFieldSchema>

const PlaylistNextPageTokenSchema = z.pipe(
  z.optional(z.nullable(z.string())),
  z.transform((token): string | null => token ?? null),
)

export const VideoPlaylistCollectionSchema = z.object({
  data: z.array(VideoPlaylistSchema),
  next_page_token: PlaylistNextPageTokenSchema,
})

export const VideoPlaylistFullCollectionSchema = z.object({
  data: z.array(VideoPlaylistFullSchema),
  next_page_token: PlaylistNextPageTokenSchema,
})

const PLAYLIST_PAGE_SIZE_ERROR = 'Page size must be an integer from 1 to 99, or "*"'

export const GetPlaylistsOptionsSchema = z
  .object({
    fields: z.optional(z.array(VideoPlaylistFieldSchema).check(z.minLength(1))),
    page_size: z.optional(
      z.union([
        z
          .int({ error: PLAYLIST_PAGE_SIZE_ERROR })
          .check(z.gte(1, PLAYLIST_PAGE_SIZE_ERROR), z.lte(99, PLAYLIST_PAGE_SIZE_ERROR)),
        z.literal('*'),
      ]),
    ),
    page_token: z.optional(z.string()),
    accept_language: z.optional(z.string().check(z.minLength(1))),
  })
  .check(
    z.refine((options) => {
      if (options.page_size !== '*') {
        return true
      }
      return (
        options.fields !== undefined && options.fields.length >= 1 && options.fields.length <= 3
      )
    }, 'page_size="*" requires 1-3 fields to be specified'),
  )

export type GetPlaylistsOptions = z.infer<typeof GetPlaylistsOptionsSchema>

export const GetPlaylistOptionsSchema = z.object({
  accept_language: z.optional(z.string().check(z.minLength(1))),
})

export type GetPlaylistOptions = z.infer<typeof GetPlaylistOptionsSchema>

export type VideoPlaylistDetail = Readonly<Required<VideoPlaylist>>
