import { ApiClient, getHttpStatus } from '@youversion/platform-core'

import { DEFAULT_API_HOST } from '../constants'
import { toMessage } from '../error-message'
import { err, ok } from '../result'
import { ImagesClient } from './client'
import type {
  GetImagesOptions,
  ImagesApiError,
  ImagesApiResult,
  YouVersionImage,
  YouVersionImagePage,
} from './types'

export type CreateImagesApiConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  additionalHeaders?: Record<string, string>
  timeout?: number
}

export type ImagesApi = {
  list: (options?: GetImagesOptions) => Promise<ImagesApiResult<YouVersionImagePage>>
  get: (imageId: string) => Promise<ImagesApiResult<YouVersionImage>>
}

export function createImagesApi(config: CreateImagesApiConfig): ImagesApi {
  const client = new ImagesClient(
    new ApiClient({
      appKey: config.appKey,
      apiHost: config.apiHost ?? DEFAULT_API_HOST,
      installationId: config.installationId,
      additionalHeaders: config.additionalHeaders,
      timeout: config.timeout,
    }),
  )

  return {
    list(options) {
      return catchAsResult(() => client.getImages(options))
    },
    get(imageId) {
      return catchAsResult(() => client.getImage(imageId))
    },
  }
}

async function catchAsResult<Value>(run: () => Promise<Value>): Promise<ImagesApiResult<Value>> {
  try {
    return ok(await run())
  } catch (caught) {
    return err(toImagesApiError(caught instanceof Error ? caught : new Error(String(caught))))
  }
}

function toImagesApiError(caught: Error): ImagesApiError {
  const status = getHttpStatus(caught)
  const message = toMessage(caught)

  if (status === 401 || status === 403) {
    return { kind: 'auth', status, message }
  }

  if (status === undefined && isZodError(caught)) {
    return { kind: 'invalid-parameter', message }
  }

  if (status === undefined) {
    return { kind: 'transient', message }
  }

  return { kind: 'transient', status, message }
}

function isZodError(caught: Error): boolean {
  return caught.name === 'ZodError' || caught.name === '$ZodError'
}
