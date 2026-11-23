// YPE-6577: replace these interim types with the `@youversion/platform-core` exports when platform-sdk-react#488 ships.
// Playlist options use #488 names: `pageSize`, `pageToken`, `acceptLanguage`.

import type { Collection } from '@youversion/platform-core'

import type { Result } from '../result'
import type {
  GetPlaylistOptions,
  GetPlaylistsOptions,
  VideoPlaylist,
  VideoPlaylistField,
} from '../content-library/interim/video-schemas'

export type {
  GetPlaylistOptions,
  GetPlaylistsOptions,
  VideoPlaylist,
  VideoPlaylistField,
}

/** Full playlist. Every field is present. Matches #488's getPlaylist return. */
export type VideoPlaylistDetail = Readonly<Required<VideoPlaylist>>

export type YouVersionPlaylistPage = Collection<VideoPlaylist>

export type PlaylistsApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'not-found'; status: 404; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; status?: number; message: string }

export type PlaylistsApiResult<Value> = Result<Value, PlaylistsApiError>
