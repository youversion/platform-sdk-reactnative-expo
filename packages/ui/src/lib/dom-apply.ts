import { YouVersionPlatformConfiguration } from '@youversion/platform-react-ui'

export function applySDKConfig(config: {
  appKey: string
  apiHost: string
  installationId: string
}) {
  YouVersionPlatformConfiguration.appKey = config.appKey
  YouVersionPlatformConfiguration.apiHost = config.apiHost
  YouVersionPlatformConfiguration.installationId = config.installationId

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('x-yvp-installation-id', config.installationId)
  }
}
