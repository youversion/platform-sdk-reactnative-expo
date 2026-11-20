// YPE-6577: replace these interim types with the `@youversion/platform-core` exports when platform-sdk-react#488 ships.

import type { Result } from '../result'
import type {
  ContentLibraryVideo,
  GetVideoOptions,
  VideoPlaybackSource,
  VideoThumbnail,
  VideoThumbnailSize,
} from '../content-library/interim/video-schemas'

export type {
  ContentLibraryVideo,
  GetVideoOptions,
  VideoPlaybackSource,
  VideoThumbnail,
  VideoThumbnailSize,
}

export type VideosApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'not-found'; status: 404; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; status?: number; message: string }

export type VideosApiResult<Value> = Result<Value, VideosApiError>
