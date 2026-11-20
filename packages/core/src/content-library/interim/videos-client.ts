// INTERIM (YPE-6577): replaced by @youversion/platform-core once platform-sdk-react#488 ships. Delete this file when adopting it.

import type { ApiClient, Collection } from '@youversion/platform-core'
import * as z from 'zod/mini'

import {
  ContentLibraryVideoSchema,
  GetPlaylistOptionsSchema,
  GetPlaylistsOptionsSchema,
  GetVideoOptionsSchema,
  VideoPlaylistCollectionSchema,
  VideoPlaylistFullCollectionSchema,
  VideoPlaylistFullSchema,
  VideoPlaylistIdSchema,
  type ContentLibraryVideo,
  type GetPlaylistOptions,
  type GetPlaylistsOptions,
  type GetVideoOptions,
  type VideoPlaylist,
  type VideoPlaylistDetail,
  type VideoPlaylistField,
} from './video-schemas'
import { VideoIdSchema } from './video-id'
import { resolveVideoThumbnail } from './video-thumbnail'

export type { GetPlaylistOptions, GetPlaylistsOptions, GetVideoOptions }

const VIDEOS_PATH = '/v1/videos'

const OrganizationIdSchema = z.pipe(
  z.string().check(z.trim()),
  z.uuid({ error: 'Organization ID must be a valid UUID' }),
)

type PlaylistsQuery = {
  'fields[]'?: VideoPlaylistField[]
  page_size?: number | '*'
  page_token?: string
}

/** Video detail and organization playlists. */
export class VideosClient {
  private readonly client: ApiClient

  constructor(client: ApiClient) {
    this.client = client
  }

  /**
   * Fetches one video by its opaque id.
   * YPE-6568: a search id can 404. The error is returned as-is. The id is not parsed or replaced.
   */
  async getVideo(videoId: string, options: GetVideoOptions = {}): Promise<ContentLibraryVideo> {
    const id = VideoIdSchema.parse(videoId)
    const parsedOptions = GetVideoOptionsSchema.parse(options)
    const path = `${VIDEOS_PATH}/${encodeURIComponent(id)}`
    let body: unknown
    if (parsedOptions.acceptLanguage === undefined) {
      body = await this.client.get<unknown>(path)
    } else {
      body = await this.client.get<unknown>(path, undefined, {
        'Accept-Language': parsedOptions.acceptLanguage,
      })
    }
    const parsed = ContentLibraryVideoSchema.safeParse(body)
    if (!parsed.success) {
      throw new Error(`Unexpected videos API response: ${parsed.error.message}`)
    }
    return resolveVideoThumbnail(parsed.data, parsedOptions.thumbnailSize)
  }

  /**
   * Lists an organization's playlists.
   * YPE-6461: a non-English Accept-Language can 204. Language defaults to English.
   * A language the caller sets is still sent. 204 and an empty body become an empty page.
   * Omitted `fields` sends no `fields[]`. `page_size: '*'` needs 1–3 selected fields.
   */
  async getPlaylists(
    organizationId: string,
    options: GetPlaylistsOptions = {},
  ): Promise<Collection<VideoPlaylist>> {
    const id = OrganizationIdSchema.parse(organizationId)
    const parsedOptions = GetPlaylistsOptionsSchema.parse(options)
    const query: PlaylistsQuery = {}
    if (parsedOptions.fields !== undefined) {
      query['fields[]'] = parsedOptions.fields
    }
    if (parsedOptions.page_size !== undefined) {
      query.page_size = parsedOptions.page_size
    }
    if (parsedOptions.page_token !== undefined) {
      query.page_token = parsedOptions.page_token
    }
    let language = 'en'
    if (parsedOptions.accept_language !== undefined) {
      language = parsedOptions.accept_language
    }
    const body = await this.client.get<unknown>(
      `/v1/organizations/${encodeURIComponent(id)}/playlists`,
      query,
      { 'Accept-Language': language },
    )
    if (body === undefined || body === '') {
      return { data: [], next_page_token: null }
    }
    const schema =
      parsedOptions.fields === undefined
        ? VideoPlaylistFullCollectionSchema
        : VideoPlaylistCollectionSchema
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw new Error(`Unexpected playlists API response: ${parsed.error.message}`)
    }
    return parsed.data
  }

  /** Fetches one playlist. Language defaults to English. */
  async getPlaylist(
    organizationId: string,
    playlistId: number,
    options: GetPlaylistOptions = {},
  ): Promise<VideoPlaylistDetail> {
    const organization = OrganizationIdSchema.parse(organizationId)
    const playlist = VideoPlaylistIdSchema.parse(playlistId)
    const parsedOptions = GetPlaylistOptionsSchema.parse(options)
    let language = 'en'
    if (parsedOptions.accept_language !== undefined) {
      language = parsedOptions.accept_language
    }
    const body = await this.client.get<unknown>(
      `/v1/organizations/${encodeURIComponent(organization)}/playlists/${playlist}`,
      undefined,
      { 'Accept-Language': language },
    )
    const parsed = VideoPlaylistFullSchema.safeParse(body)
    if (!parsed.success) {
      throw new Error(`Unexpected playlists API response: ${parsed.error.message}`)
    }
    return parsed.data
  }
}
