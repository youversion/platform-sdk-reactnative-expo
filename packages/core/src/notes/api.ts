// YPE-6786: this wrapper stays. Swap `NotesClient` for `@youversion/platform-core` when platform-sdk-react#497 ships.

import { createApiClient } from '../api-client'
import { NotesClient } from './interim/notes-client'
import type { CreateNote, GetNotesOptions, Note, UpdateNote } from './interim/note-schema'
import type { NotePage } from './types'

export type CreateNotesApiConfig = {
  appKey: string
  installationId: string
  apiHost?: string
  additionalHeaders?: Record<string, string>
  timeout?: number
}

export type NotesApi = {
  list: (accessToken: string, options?: GetNotesOptions) => Promise<NotePage>
  get: (accessToken: string, noteId: string) => Promise<Note>
  create: (accessToken: string, data: CreateNote) => Promise<Note>
  update: (accessToken: string, noteId: string, data: UpdateNote) => Promise<Note>
  delete: (accessToken: string, noteId: string) => Promise<void>
}

export function createNotesApi(config: CreateNotesApiConfig): NotesApi {
  const client = new NotesClient(createApiClient(config))

  return {
    list(accessToken, options) {
      return client.getNotes(options, accessToken)
    },
    get(accessToken, noteId) {
      return client.getNote(noteId, accessToken)
    },
    create(accessToken, data) {
      return client.createNote(data, accessToken)
    },
    update(accessToken, noteId, data) {
      return client.updateNote(noteId, data, accessToken)
    },
    delete(accessToken, noteId) {
      return client.deleteNote(noteId, accessToken)
    },
  }
}
