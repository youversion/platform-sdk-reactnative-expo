import { YouVersionPlatformConfiguration } from '@youversion/platform-react-ui'

export function applySDKConfig(config: {
  appKey: string
  apiHost: string
  installationId: string
}): void {
  YouVersionPlatformConfiguration.appKey = config.appKey
  YouVersionPlatformConfiguration.apiHost = config.apiHost
  YouVersionPlatformConfiguration.installationId = config.installationId

  try {
    localStorage.setItem('x-yvp-installation-id', config.installationId)
  } catch {
    // localStorage missing (Android DOM WebView) or blocked.
  }
}

/**
 * One-time residue clear. Prior SDK versions handed the reader WebView the
 * signed-in access token, and `saveAuthData` writes it into WebView
 * `localStorage`. On iOS that store is disk-backed, so the token survives app
 * relaunch on an upgrading install. Nothing inside the WebView needs it — the
 * reader is a pure view — so remove it rather than keep refreshing it.
 *
 * The three `null`s remove the `accessToken`, `refreshToken`, and `expiryDate`
 * keys. Only `accessToken` was ever written by this SDK; the other two are
 * cleared for the same price.
 */
export function clearAuthResidue(): void {
  YouVersionPlatformConfiguration.saveAuthData(null, null, null)
}
