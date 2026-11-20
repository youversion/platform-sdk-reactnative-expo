// YPE-6577: this hook stays. Call `list` or `get` again to retry. Errors use the same kinds as `useImages`.

import { useMemo } from 'react'

import { useYouVersion } from '../use-youversion'
import { createPlaylistsApi, type PlaylistsApi } from './api'

export type UsePlaylistsResult = PlaylistsApi

export function usePlaylists(): UsePlaylistsResult {
  const { appKey, apiHost, installationId, hookOverrides } = useYouVersion()
  const override = hookOverrides?.usePlaylists
  const api = useMemo(
    () => createPlaylistsApi({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )
  return override?.() ?? api
}
