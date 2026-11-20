// YPE-6577: this hook stays. Call `get` again to retry. Errors use the same kinds as `useImages`.

import { useMemo } from 'react'

import { useYouVersion } from '../use-youversion'
import { createVideosApi, type VideosApi } from './api'

export type UseVideosResult = VideosApi

export function useVideos(): UseVideosResult {
  const { appKey, apiHost, installationId, hookOverrides } = useYouVersion()
  const override = hookOverrides?.useVideos
  const api = useMemo(
    () => createVideosApi({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )
  return override?.() ?? api
}
