import type {
  AuthContextValue,
  HookOverrides,
  UseHighlightPermissionFlowResult,
  UseHighlightsOptions,
  UseHighlightsResult,
} from '@youversion/platform-react-native-expo-core'

export function emptyHighlights(options: UseHighlightsOptions): UseHighlightsResult {
  return {
    highlights: [],
    scope: {
      versionId: options.versionId,
      book: options.book,
      chapter: options.chapter,
    },
    isRefreshing: false,
    error: null,
    refresh: async () => undefined,
    apply: async () => ({ status: 'noop' }),
    remove: async () => ({ status: 'noop' }),
  }
}

export function signedOutAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    isAuthenticated: false,
    accessToken: null,
    userInfo: null,
    error: null,
    signIn: async () => undefined,
    signOut: async () => undefined,
    refreshNow: async () => undefined,
    getAccessToken: async () => ({ status: 'unavailable', reason: 'signed-out' }),
    isLoading: false,
    requestedPermissions: [],
    grantedPermissions: null,
    hasPermission: () => false,
    invalidatePermissions: () => undefined,
    requestPermissions: async () => ({ status: 'cancel' }),
    ...overrides,
  }
}

export function defaultPermissionFlow(
  options: UseHighlightsOptions,
): UseHighlightPermissionFlowResult {
  return {
    highlights: emptyHighlights(options),
    isConfirming: false,
    apply: async () => ({ status: 'noop' }),
    confirm: () => undefined,
    decline: () => undefined,
    flowError: null,
  }
}

export const defaultHookOverrides: HookOverrides = {
  useYVAuth: signedOutAuth(),
  useHighlights: emptyHighlights,
  useHighlightPermissionFlow: defaultPermissionFlow,
}
