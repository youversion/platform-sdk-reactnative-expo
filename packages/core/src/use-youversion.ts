import { use } from 'react'
import { YouVersionContext, type YouVersionContextValue } from './youversion-context'

export function useYouVersion(): YouVersionContextValue {
  const ctx = use(YouVersionContext)
  if (!ctx) {
    throw new Error('useYouVersion must be used inside of YouVersionProvider')
  }
  return ctx
}
