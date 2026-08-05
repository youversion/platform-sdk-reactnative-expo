export { useYouVersion } from './use-youversion'
export type { YouVersionContextValue } from './youversion-context'
export { default as YouVersionProvider } from './youversion-provider'

export { useYVAuth, useYVAuthOptional } from './auth'
export type {
  AuthConfig,
  AuthContextValue,
  AuthPermission,
  AuthScope,
  DataExchangeFailureReason,
  DataExchangeOutcome,
  KnownAuthPermission,
  YVUserInfo,
} from './auth'

export {
  deriveServerColors,
  HIGHLIGHT_COLORS,
  isHighlightColor,
  useHighlightPermissionFlow,
  useHighlights,
} from './highlights'
export type {
  Highlight,
  HighlightColor,
  HighlightScope,
  HighlightsFetchError,
  HighlightWriteOutcome,
  HighlightWriteReason,
  PermissionFlowError,
  PermissionFlowErrorReason,
  ServerColors,
  UseHighlightPermissionFlowResult,
  UseHighlightsOptions,
  UseHighlightsResult,
} from './highlights'

export { mmkvStorage } from './storage'
