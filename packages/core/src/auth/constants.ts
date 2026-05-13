export const SECURE_STORAGE_KEYS = {
  accessToken: 'yvp.accessToken',
  refreshToken: 'yvp.refreshToken',
  idToken: 'yvp.idToken',
} as const

export const MMKV_KEYS = {
  expiryDateISO: 'yvp.expiryDate',
  installationId: 'yvp.installationId',
  cachedUserInfo: 'yvp.userInfo',
} as const

export const DEFAULT_API_HOST = 'api.youversion.com'
export const DEFAULT_SCOPES = ['profile', 'email'] as const

export const REFRESH_LEEWAY_SECONDS = 60 // 60 seconds
