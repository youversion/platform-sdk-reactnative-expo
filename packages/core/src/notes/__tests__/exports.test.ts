import * as core from '../../index'
import type {
  CreateNote,
  GetNotesOptions,
  Note,
  NotePage,
  NotePassage,
  UpdateNote,
  UseNotesResult,
} from '../../index'

describe('notes package exports', () => {
  it('exposes the notes hook', () => {
    expect(core.useNotes).toEqual(expect.any(Function))
  })

  it('keeps the client wrapper and the Result seam internal', () => {
    const names = Object.keys(core)
    expect(names).not.toContain('createNotesApi')
    expect(names).not.toContain('NotesClient')
    expect(names).not.toContain('NotesApiError')
    expect(names).not.toContain('NotesApiResult')
    expect(names).not.toContain('ApiClient')
    expect(names).not.toContain('createApiClient')
    expect(names).not.toContain('DEFAULT_API_HOST')
    expect(names).not.toContain('ok')
    expect(names).not.toContain('err')
  })

  it('exports the note write and page types', () => {
    const create = {
      request_id: '2f8c5d2e-6f6c-4b4f-9b36-8c1b5a17d3f9',
      content: 'Trust in God.',
      status: 'private',
    } satisfies CreateNote
    const update = { title: null } satisfies UpdateNote
    const page = {
      data: [{ id: 'note-1', content: 'Trust in God.', status: 'private' }],
      next_page_token: null,
    } satisfies NotePage
    const note = page.data[0] satisfies Note | undefined
    const listOptions = { version_id: 111, passage_id: 'JHN.3.16' } satisfies GetNotesOptions
    const passage = { version_id: 111, passage_id: 'JHN.3.16' } satisfies NotePassage
    const pinnedNote = {
      id: 'note-1',
      content: 'Trust in God.',
      status: 'private',
    } satisfies Note
    const hook: UseNotesResult = {
      list: async () => page,
      get: async () => pinnedNote,
      create: async () => pinnedNote,
      update: async () => pinnedNote,
      delete: async () => undefined,
    }

    expect(create.request_id).toBe('2f8c5d2e-6f6c-4b4f-9b36-8c1b5a17d3f9')
    expect(update.title).toBeNull()
    expect(note?.id).toBe('note-1')
    expect(page.next_page_token).toBeNull()
    expect(listOptions.passage_id).toBe('JHN.3.16')
    expect(passage.version_id).toBe(111)
    expect(hook.delete).toEqual(expect.any(Function))
  })
})
