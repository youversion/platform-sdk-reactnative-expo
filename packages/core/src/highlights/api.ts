import {
  ApiClient,
  HighlightsClient,
  type Collection,
  type CreateHighlight,
  type DeleteHighlightOptions,
  type GetHighlightsOptions,
  type Highlight,
} from '@youversion/platform-core'

import { DEFAULT_API_HOST } from '../constants'
import { err, ok, type Result } from '../result'

export type { Collection, CreateHighlight, DeleteHighlightOptions, GetHighlightsOptions, Highlight }

/** Mirrors Web's binary split: 401/403 vs everything else (network, 5xx, validation). */
export type HighlightsApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'transient'; status?: number; message: string }

export type HighlightsApiResult<T> = Result<T, HighlightsApiError>

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

async function catchAsResult<T>(run: () => Promise<T>): Promise<HighlightsApiResult<T>> {
  try {
    return ok(await run())
  } catch (caught) {
    return err(toHighlightsApiError(caught))
  }
}

function toHighlightsApiError(caught: unknown): HighlightsApiError {
  const status = extractStatus(caught)
  const message = caught instanceof Error ? caught.message : String(caught)

  if (status === 401 || status === 403) {
    return { kind: 'auth', status, message }
  }

  return status === undefined
    ? { kind: 'transient', message }
    : { kind: 'transient', status, message }
}

/** Pulls an HTTP status off a thrown ApiClient error (same shape Web uses). */
function extractStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
  }
  return undefined
}
