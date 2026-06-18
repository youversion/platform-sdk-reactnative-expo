import { YouVersionPlatformConfiguration } from '@youversion/platform-react-ui'

export function applySDKConfig(config: {
  appKey: string
  apiHost: string
  installationId: string
}) {
  YouVersionPlatformConfiguration.appKey = config.appKey
  YouVersionPlatformConfiguration.apiHost = config.apiHost
  YouVersionPlatformConfiguration.installationId = config.installationId

  // `typeof localStorage` is `'object'` when it is `null` (Android DOM WebView
  // with DOM storage disabled), so the nullish check is required, not just the
  // `typeof` guard. `dom-local-storage` normally shims this to a real object.
  if (typeof localStorage !== 'undefined' && localStorage != null) {
    localStorage.setItem('x-yvp-installation-id', config.installationId)
  }
}

export function applyAuthToken(accessToken: string | null) {
  YouVersionPlatformConfiguration.saveAuthData(accessToken, null, null)
}
