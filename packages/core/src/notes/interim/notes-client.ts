// INTERIM (YPE-6786): replaced by @youversion/platform-core once platform-sdk-react#497 ships. Delete this file when adopting it.
// Mirrors packages/core/src/notes.ts @ 10dd292a71aaf8fac5fe07aa46d5ff7c98a99b87.

import type { ApiClient, Collection } from '@youversion/platform-core'
import * as z from 'zod/mini'

import { resolveAuthToken } from './auth-token'
import { getWithStatus, sendJson, type NoteWriteBody, type NotesQuery } from './http'
import {
  CreateNoteSchema,
  GetNotesOptionsSchema,
  NoteSchema,
  NotesPageSchema,
  UpdateNoteSchema,
} from './note-schema'
import type { CreateNote, GetNotesOptions, Note, NotePassage, UpdateNote } from './note-schema'

const NOTES_PATH = '/v1/notes'

type BearerAuthHeaders = { Authorization: string }

const NoteIdSchema = z
  .string()
  .check(
    z.refine(
      (id) => id.trim().length > 0 && id !== '.' && id !== '..',
      'Note ID must be a non-empty resource identifier',
    ),
  )

function notePath(noteId: string): string {
  return `${NOTES_PATH}/${encodeURIComponent(NoteIdSchema.parse(noteId))}`
}

function authHeaders(lat?: string): BearerAuthHeaders {
  return { Authorization: `Bearer ${resolveAuthToken(lat, 'accessing notes')}` }
}

function toNoteBody<T extends { passage?: NotePassage | null | undefined }>(
  data: T,
): NoteWriteBody {
  const { passage, ...fields } = data
  if (passage === undefined) {
    // SAFETY: schema parse already limited these keys to a note write. The annotation
    // exists so sendJson can accept a null field, which 2.17's post type cannot.
    return fields as NoteWriteBody
  }
  return {
    ...fields,
    passage: passage && { bible_id: passage.version_id, passage_id: passage.passage_id },
  }
}

/**
 * Client for the authenticated user's notes (`/v1/notes`).
 * Reads require `read_notes`; writes require `write_notes`.
 * Pass a long access token per call, or use the signed-in platform session.
 */
export class NotesClient {
  private client: ApiClient

  constructor(client: ApiClient) {
    this.client = client
  }

  /** Lists one page of notes. An empty page can still have a `next_page_token`. */
  async getNotes(options: GetNotesOptions = {}, lat?: string): Promise<Collection<Note>> {
    const { version_id, passage_id, page_size, page_token } = GetNotesOptionsSchema.parse(options)
    const query: NotesQuery = {}
    if (version_id !== undefined) query.bible_id = version_id
    if (passage_id !== undefined) query.passage_id = passage_id
    if (page_size !== undefined) query.page_size = page_size
    if (page_token != null) query.page_token = page_token
    // RN: 2.17 ApiClient has no getWithStatus. A 204 must stay an empty page.
    const { status, data } = await getWithStatus<unknown>(
      this.client,
      NOTES_PATH,
      query,
      authHeaders(lat),
    )
    if (status === 204) {
      return { data: [], next_page_token: null }
    }
    const page = NotesPageSchema.parse(data)
    return { data: page.data, next_page_token: page.next_page_token ?? null }
  }

  /** Gets one note by its id. */
  async getNote(noteId: string, lat?: string): Promise<Note> {
    const response = await this.client.get<unknown>(notePath(noteId), undefined, authHeaders(lat))
    return NoteSchema.parse(response)
  }

  /** Creates a note using the caller's `request_id` for idempotent retries. */
  async createNote(data: CreateNote, lat?: string): Promise<Note> {
    const body = toNoteBody(CreateNoteSchema.parse(data))
    // RN: 2.17 ApiClient.post cannot type a null field. sendJson keeps it.
    const response = await sendJson<unknown>(
      this.client,
      'POST',
      NOTES_PATH,
      body,
      authHeaders(lat),
    )
    return NoteSchema.parse(response)
  }

  /** Updates only the supplied fields. `null` clears nullable fields. */
  async updateNote(noteId: string, data: UpdateNote, lat?: string): Promise<Note> {
    const body = toNoteBody(UpdateNoteSchema.parse(data))
    // RN: 2.17 ApiClient has no patch. sendJson sends the same JSON PATCH.
    const response = await sendJson<unknown>(
      this.client,
      'PATCH',
      notePath(noteId),
      body,
      authHeaders(lat),
    )
    return NoteSchema.parse(response)
  }

  /** Deletes a note by its id. The successful response has no body. */
  async deleteNote(noteId: string, lat?: string): Promise<void> {
    await this.client.delete<void>(notePath(noteId), undefined, authHeaders(lat))
  }
}
