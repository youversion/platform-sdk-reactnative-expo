// YPE-6577: replace these interim types with the `@youversion/platform-core` exports when platform-sdk-react#488 ships.
// Playlist options keep platform-core names: `page_size`, `page_token`, `accept_language`.

import type { Collection } from '@youversion/platform-core'

import type { Result } from '../result'
import type {
  GetPlaylistOptions,
  GetPlaylistsOptions,
  VideoPlaylist,
  VideoPlaylistDetail,
  VideoPlaylistField,
} from '../content-library/interim/video-schemas'

export type {
  GetPlaylistOptions,
  GetPlaylistsOptions,
  VideoPlaylist,
  VideoPlaylistDetail,
  VideoPlaylistField,
}

export type YouVersionPlaylistPage = Collection<VideoPlaylist>

export type PlaylistsApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'not-found'; status: 404; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; status?: number; message: string }

export type PlaylistsApiResult<Value> = Result<Value, PlaylistsApiError>
