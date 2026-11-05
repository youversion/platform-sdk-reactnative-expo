import {
  ApiClient,
  BibleClient,
  getHttpStatus,
  type GetVOTDOptions,
} from '@youversion/platform-core'

import { DEFAULT_API_HOST } from '../constants'
import { toMessage } from '../error-message'
import { err, ok } from '../result'
import { mergeSdkHeaders } from '../sdk-version'
import { isZodError } from '../zod-error'
import type {
  VerseOfTheDayApiError,
  VerseOfTheDayApiResult,
  VerseOfTheDayOptions,
  YouVersionVerseOfTheDay,
  YouVersionVerseOfTheDayPage,
} from './types'

export type CreateVerseOfTheDayApiConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  additionalHeaders?: Record<string, string>
  timeout?: number
}

export type VerseOfTheDayApi = {
  get: (
    day: number,
    options?: VerseOfTheDayOptions,
  ) => Promise<VerseOfTheDayApiResult<YouVersionVerseOfTheDay>>
  list: (
    options?: VerseOfTheDayOptions,
  ) => Promise<VerseOfTheDayApiResult<YouVersionVerseOfTheDayPage>>
}

function votdOptions(options?: VerseOfTheDayOptions): GetVOTDOptions {
  return { language_ranges: options?.languageRanges }
}

export function createVerseOfTheDayApi(config: CreateVerseOfTheDayApiConfig): VerseOfTheDayApi {
  const client = new BibleClient(
    new ApiClient({
      appKey: config.appKey,
      apiHost: config.apiHost ?? DEFAULT_API_HOST,
      installationId: config.installationId,
      additionalHeaders: mergeSdkHeaders(config.additionalHeaders),
      timeout: config.timeout,
    }),
  )

  return {
    get(day, options) {
      return catchAsResult(() => client.getVOTD(day, votdOptions(options)))
    },
    list(options) {
      return catchAsResult(() => client.getAllVOTDs(votdOptions(options)))
    },
  }
}

async function catchAsResult<Value>(
  run: () => Promise<Value>,
): Promise<VerseOfTheDayApiResult<Value>> {
  try {
    return ok(await run())
  } catch (caught) {
    return err(
      toVerseOfTheDayApiError(caught instanceof Error ? caught : new Error(String(caught))),
    )
  }
}

function toVerseOfTheDayApiError(caught: Error): VerseOfTheDayApiError {
  const status = getHttpStatus(caught)
  const message = toMessage(caught)

  if (status === 401 || status === 403) {
    return { kind: 'auth', status, message }
  }

  if (status === 404) {
    return { kind: 'not-found', status, message }
  }

  if (isClientError(status)) {
    return { kind: 'invalid-parameter', status, message }
  }

  if (status === undefined && isZodError(caught)) {
    return { kind: 'invalid-parameter', message }
  }

  if (status === undefined) {
    return { kind: 'transient', message }
  }

  return { kind: 'transient', status, message }
}

function isClientError(status: number | undefined): status is number {
  if (status === undefined) return false
  if (status === 401 || status === 403 || status === 404) return false
  if (status === 408 || status === 429) return false
  return status >= 400 && status < 500
}
