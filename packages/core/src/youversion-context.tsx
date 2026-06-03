import { createContext } from 'react'

export type YouVersionContextValue = {
  appKey: string
  apiHost: string
  installationId: string
}

export const YouVersionContext = createContext<YouVersionContextValue | null>(null)
