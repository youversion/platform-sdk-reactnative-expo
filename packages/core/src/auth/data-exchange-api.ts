import { ApiClient, DataExchangeClient } from '@youversion/platform-core'
import { z } from 'zod'

import { DEFAULT_API_HOST } from '../constants'
import { toMessage } from '../error-message'
import { err, ok, type Result } from '../result'

/**
 * The mint's 401 is "this app may not run data exchange", not "retry later", so
 * it gets its own kind — callers surface it differently from a flaky network.
 * Everything else (network, 5xx, schema failure) collapses to `transient`.
 */
export type DataExchangeError =
  | { kind: 'not-permitted'; message: string }
  | { kind: 'transient'; status?: number; message: string }

export type DataExchangeApiResult<Value> = Result<Value, DataExchangeError>

export type CreateDataExchangeApiConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  timeout?: number
}

export type DataExchangeApi = {
  /**
   * Mints a short-lived data-exchange token for `permissions`.
   * `POST /data-exchange/token?app-key=<appKey>`, expecting `201 { token }`.
   */
  mintToken: (
    accessToken: string,
    permissions: readonly string[],
  ) => Promise<DataExchangeApiResult<string>>
}

export function createDataExchangeApi(config: CreateDataExchangeApiConfig): DataExchangeApi {
  const client = new DataExchangeClient(
    new ApiClient({
      appKey: config.appKey,
      apiHost: config.apiHost ?? DEFAULT_API_HOST,
      installationId: config.installationId,
      timeout: config.timeout,
    }),
  )

  return {
    async mintToken(accessToken, permissions) {
      try {
        // `lat` is always passed explicitly. Left off, platform-core falls back
        // to the ambient browser configuration, which on RN is either empty (a
        // throw) or — worse, once anything else populates it — a token that is
        // not the one this provider is signed in with.
        return ok(await client.updateToken([...permissions], accessToken))
      } catch (caught) {
        return err(toDataExchangeError(caught instanceof Error ? caught : new Error(String(caught))))
      }
    },
  }
}

function toDataExchangeError(caught: Error): DataExchangeError {
  const status = extractStatus(caught)
  const message = toMessage(caught)

  if (status === 401) {
    return { kind: 'not-permitted', message }
  }

  return status === undefined
    ? { kind: 'transient', message }
    : { kind: 'transient', status, message }
}

const httpStatusErrorSchema = z.object({
  status: z.number(),
})

/** Pulls an HTTP status off a thrown ApiClient error. Twin of the one in `highlights/api.ts`. */
function extractStatus(error: Error): number | undefined {
  const parsed = httpStatusErrorSchema.safeParse(error)
  return parsed.success ? parsed.data.status : undefined
}
