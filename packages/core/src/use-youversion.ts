import { useContext } from 'react'
import { YouVersionContext, type YouVersionContextValue } from './youversion-context'

export function useYouVersion(): YouVersionContextValue {
  const ctx = useContext(YouVersionContext)
  if (!ctx) {
    throw new Error('useYouVersion must be used inside of YouVersionProvider')
  }
  return ctx
}
