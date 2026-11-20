// YPE-6577: this wrapper stays. Swap `VideosClient` for `@youversion/platform-core` when platform-sdk-react#488 ships.

import { getHttpStatus } from '@youversion/platform-core'

import { createApiClient } from '../api-client'
import { VideosClient } from '../content-library/interim/videos-client'
import { toMessage } from '../error-message'
import { err, ok } from '../result'
import { isZodError } from '../zod-error'
import type {
  GetPlaylistOptions,
  GetPlaylistsOptions,
  VideoPlaylistDetail,
} from '../content-library/interim/video-schemas'
import type { PlaylistsApiError, PlaylistsApiResult, YouVersionPlaylistPage } from './types'

export type CreatePlaylistsApiConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  additionalHeaders?: Record<string, string>
  timeout?: number
}

export type PlaylistsApi = {
  list: (
    organizationId: string,
    options?: GetPlaylistsOptions,
  ) => Promise<PlaylistsApiResult<YouVersionPlaylistPage>>
  get: (
    organizationId: string,
    playlistId: number,
    options?: GetPlaylistOptions,
  ) => Promise<PlaylistsApiResult<VideoPlaylistDetail>>
}

export function createPlaylistsApi(config: CreatePlaylistsApiConfig): PlaylistsApi {
  const client = new VideosClient(createApiClient(config))

  return {
    list(organizationId, options) {
      return catchAsResult(() => client.getPlaylists(organizationId, options))
    },
    get(organizationId, playlistId, options) {
      return catchAsResult(() => client.getPlaylist(organizationId, playlistId, options))
    },
  }
}

async function catchAsResult<Value>(
  run: () => Promise<Value>,
): Promise<PlaylistsApiResult<Value>> {
  try {
    return ok(await run())
  } catch (caught) {
    return err(toPlaylistsApiError(caught instanceof Error ? caught : new Error(String(caught))))
  }
}

function toPlaylistsApiError(caught: Error): PlaylistsApiError {
  const status = getHttpStatus(caught)
  const message = toMessage(caught)

  if (status === 401 || status === 403) {
    return { kind: 'auth', status, message }
  }

  if (status === 404) {
    return { kind: 'not-found', status, message }
  }

  if (isClientError(status)) {
    return { kind: 'invalid-parameter', status, message }
  }

  if (status === undefined && isZodError(caught)) {
    return { kind: 'invalid-parameter', message }
  }

  if (status === undefined) {
    return { kind: 'transient', message }
  }

  return { kind: 'transient', status, message }
}

function isClientError(status: number | undefined): status is number {
  if (status === undefined) return false
  if (status === 401 || status === 403 || status === 404) return false
  if (status === 408 || status === 429) return false
  return status >= 400 && status < 500
}
