import {
  ApiClient,
  HighlightsClient,
  type Collection,
  type CreateHighlight,
  type DeleteHighlightOptions,
  type GetHighlightsOptions,
  type Highlight,
} from '@youversion/platform-core'
import { z } from 'zod'

import { DEFAULT_API_HOST } from '../constants'
import { toMessage } from '../error-message'
import { err, ok, type Result } from '../result'
import { ensureCryptoRandomUUID } from './ensure-crypto-uuid'

export type { Collection, CreateHighlight, DeleteHighlightOptions, GetHighlightsOptions, Highlight }

/** Mirrors Web's binary split: 401/403 vs everything else (network, 5xx, validation). */
export type HighlightsApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'transient'; status?: number; message: string }

export type HighlightsApiResult<Value> = Result<Value, HighlightsApiError>

export type CreateHighlightsApiConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  additionalHeaders?: Record<string, string>
  timeout?: number
}

export type HighlightsApi = {
  getHighlights: (
    accessToken: string,
    options: GetHighlightsOptions,
  ) => Promise<HighlightsApiResult<Collection<Highlight>>>
  createHighlight: (
    accessToken: string,
    data: CreateHighlight,
  ) => Promise<HighlightsApiResult<Highlight>>
  deleteHighlight: (
    accessToken: string,
    passageId: string,
    options: DeleteHighlightOptions,
  ) => Promise<HighlightsApiResult<void>>
}

export function createHighlightsApi(config: CreateHighlightsApiConfig): HighlightsApi {
  // platform-core's createHighlight generates the required `request_id` via
  // `crypto.randomUUID`, absent on RN Hermes. Install the expo-crypto-backed
  // shim before constructing the client so creates send a real UUID (not the
  // yvp- fallback the API 422s). Idempotent; also runs on module import.
  ensureCryptoRandomUUID()

  const client = new HighlightsClient(
    new ApiClient({
      appKey: config.appKey,
      apiHost: config.apiHost ?? DEFAULT_API_HOST,
      installationId: config.installationId,
      additionalHeaders: config.additionalHeaders,
      timeout: config.timeout,
    }),
  )

  return {
    getHighlights(accessToken, options) {
      return catchAsResult(() => client.getHighlights(options, accessToken))
    },
    createHighlight(accessToken, data) {
      return catchAsResult(() => client.createHighlight(data, accessToken))
    },
    deleteHighlight(accessToken, passageId, options) {
      return catchAsResult(() => client.deleteHighlight(passageId, options, accessToken))
    },
  }
}

async function catchAsResult<Value>(
  run: () => Promise<Value>,
): Promise<HighlightsApiResult<Value>> {
  try {
    return ok(await run())
  } catch (caught) {
    return err(toHighlightsApiError(caught instanceof Error ? caught : new Error(String(caught))))
  }
}

function toHighlightsApiError(caught: Error): HighlightsApiError {
  const status = extractStatus(caught)
  const message = toMessage(caught)

  if (status === 401 || status === 403) {
    return { kind: 'auth', status, message }
  }

  return status === undefined
    ? { kind: 'transient', message }
    : { kind: 'transient', status, message }
}

const httpStatusErrorSchema = z.object({
  status: z.number(),
})

/** Pulls an HTTP status off a thrown ApiClient error (same shape Web uses). */
function extractStatus(error: Error): number | undefined {
  const parsed = httpStatusErrorSchema.safeParse(error)
  return parsed.success ? parsed.data.status : undefined
}
