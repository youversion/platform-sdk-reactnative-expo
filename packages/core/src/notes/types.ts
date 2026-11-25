// YPE-6786: replace these interim types with the `@youversion/platform-core` exports when platform-sdk-react#497 ships.

import type { Collection } from '@youversion/platform-core'

import type {
  CreateNote,
  GetNotesOptions,
  Note,
  NotePassage,
  UpdateNote,
} from './interim/note-schema'

export type { CreateNote, GetNotesOptions, Note, NotePassage, UpdateNote }

export type NotePage = Collection<Note>
