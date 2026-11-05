import { ApiClient } from '@youversion/platform-core'

import { DEFAULT_API_HOST } from './default-api-host'
import { mergeSdkHeaders } from './sdk-version'

export type CreateApiClientConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  additionalHeaders?: Record<string, string>
  timeout?: number
}

export function createApiClient({
  appKey,
  installationId,
  apiHost,
  additionalHeaders,
  timeout,
}: CreateApiClientConfig): ApiClient {
  return new ApiClient({
    appKey,
    apiHost: apiHost || DEFAULT_API_HOST,
    installationId,
    // platform-core stamps ReactSDK=; override with this SDK's stamp (ADR 0012).
    additionalHeaders: mergeSdkHeaders(additionalHeaders),
    timeout,
  })
}
