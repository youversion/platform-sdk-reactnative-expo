// YPE-6786: this hook stays. Pass the token from `useYVAuth().getAccessToken()`.

import { useMemo } from 'react'

import { useYouVersion } from '../use-youversion'
import { createNotesApi, type NotesApi } from './api'

export type UseNotesResult = NotesApi

export function useNotes(): UseNotesResult {
  const { appKey, apiHost, installationId, hookOverrides } = useYouVersion()
  const override = hookOverrides?.useNotes
  const api = useMemo(
    () => createNotesApi({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )
  return override?.() ?? api
}
