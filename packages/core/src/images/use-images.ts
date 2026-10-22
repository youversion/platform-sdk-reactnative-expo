import { useMemo } from 'react'

import { useYouVersion } from '../use-youversion'
import { createImagesApi, type ImagesApi } from './api'

export type UseImagesResult = ImagesApi

export function useImages(): UseImagesResult {
  const { appKey, apiHost, installationId, hookOverrides } = useYouVersion()
  const override = hookOverrides?.useImages
  const api = useMemo(
    () => createImagesApi({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )
  return override?.() ?? api
}
