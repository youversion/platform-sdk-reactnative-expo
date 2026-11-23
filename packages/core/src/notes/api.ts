// YPE-6786: this wrapper stays. Swap `NotesClient` for `@youversion/platform-core` when platform-sdk-react#497 ships.

import { getHttpStatus } from '@youversion/platform-core'

import { createApiClient } from '../api-client'
import { toMessage } from '../error-message'
import { err, ok } from '../result'
import { isZodError } from '../zod-error'
import { NotesClient } from './interim/notes-client'
import type { CreateNote, GetNotesOptions, Note, UpdateNote } from './interim/note-schema'
import type { NotePage, NotesApiError, NotesApiResult } from './types'

export type CreateNotesApiConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  additionalHeaders?: Record<string, string>
  timeout?: number
}

export type NotesApi = {
  list: (accessToken: string, options?: GetNotesOptions) => Promise<NotesApiResult<NotePage>>
  get: (accessToken: string, noteId: string) => Promise<NotesApiResult<Note>>
  create: (accessToken: string, data: CreateNote) => Promise<NotesApiResult<Note>>
  update: (accessToken: string, noteId: string, data: UpdateNote) => Promise<NotesApiResult<Note>>
  delete: (accessToken: string, noteId: string) => Promise<NotesApiResult<void>>
}

export function createNotesApi(config: CreateNotesApiConfig): NotesApi {
  const client = new NotesClient(createApiClient(config))

  return {
    list(accessToken, options) {
      return catchAsResult(() => client.getNotes(options, accessToken))
    },
    get(accessToken, noteId) {
      return catchAsResult(() => client.getNote(noteId, accessToken))
    },
    create(accessToken, data) {
      return catchAsResult(() => client.createNote(data, accessToken))
    },
    update(accessToken, noteId, data) {
      return catchAsResult(() => client.updateNote(noteId, data, accessToken))
    },
    delete(accessToken, noteId) {
      return catchAsResult(() => client.deleteNote(noteId, accessToken))
    },
  }
}

async function catchAsResult<Value>(run: () => Promise<Value>): Promise<NotesApiResult<Value>> {
  try {
    return ok(await run())
  } catch (caught) {
    return err(toNotesApiError(caught instanceof Error ? caught : new Error(String(caught))))
  }
}

function toNotesApiError(caught: Error): NotesApiError {
  const status = getHttpStatus(caught)
  const message = toMessage(caught)

  if (message.startsWith('Authentication required')) {
    // RN: the client rejects a missing token before HTTP. 401 matches the other auth errors.
    return { kind: 'auth', status: 401, message }
  }

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
