// YPE-6786: replace these interim types with the `@youversion/platform-core` exports when platform-sdk-react#497 ships.

import type { Collection } from '@youversion/platform-core'

import type { Result } from '../result'
import type {
  CreateNote,
  GetNotesOptions,
  Note,
  NotePassage,
  UpdateNote,
} from './interim/note-schema'

export type { CreateNote, GetNotesOptions, Note, NotePassage, UpdateNote }

export type NotePage = Collection<Note>

export type NotesApiError =
  | { kind: 'auth'; status: 401 | 403; message: string }
  | { kind: 'not-found'; status: 404; message: string }
  | { kind: 'transient'; status?: number; message: string }
  | { kind: 'invalid-parameter'; status?: number; message: string }

export type NotesApiResult<Value> = Result<Value, NotesApiError>
