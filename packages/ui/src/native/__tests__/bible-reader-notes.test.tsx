/**
 * Save opens the note composer for the selection the reader was showing,
 * including a gap, and only after the action sheet has closed.
 */
import type { CreateNote, HookOverrides, Note } from '@youversion/platform-react-native-expo-core'
import { act, fireEvent, render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'

import type { BibleReaderVerseSelection } from '../../types/bible-ui-types'
import { signedOutAuth } from '../../test-utils/default-hook-overrides'
import { resetImpls, setImpl, stubImpl } from '../../test-utils/install-test-impls'
import { youVersionProviderWrapper } from '../../test-utils/youversion-provider-wrapper'
import { BibleReader } from '../bible-reader'
import { emptyHighlights } from '../../test-utils/default-hook-overrides'

const VERSION_ID = 111

const GAPPED: BibleReaderVerseSelection = {
  versionId: VERSION_ID,
  book: 'JHN',
  chapter: '1',
  verses: [1, 2, 4],
  passageIds: ['JHN.1.1', 'JHN.1.2', 'JHN.1.4'],
  reference: 'John 1:1-2,4',
  shareData: null,
}

const savedNote = {
  id: 'note-1',
  content: '',
  status: 'private',
  title: null,
  color: null,
  passage: { version_id: VERSION_ID, passage_id: 'JHN.1.1-2+JHN.1.4' },
  language_tag: null,
  tags: null,
} satisfies Note

const createNote = jest.fn(async (_token: string, _body: CreateNote) => savedNote)
const refreshHighlights = jest.fn(async () => undefined)

let mockNextVerseSelection: BibleReaderVerseSelection = GAPPED
let lastSelection: BibleReaderVerseSelection = GAPPED

function useHighlightPermissionFlow() {
  return {
    highlights: { ...emptyHighlights({ versionId: VERSION_ID, book: 'JHN', chapter: '1' }), refresh: refreshHighlights },
    isConfirming: false,
    apply: jest.fn(async () => ({ status: 'noop' as const })),
    confirm: jest.fn(),
    decline: jest.fn(),
    flowError: null,
  }
}

const hookOverrides: HookOverrides = {
  useYVAuth: null,
  useHighlightPermissionFlow,
  useNotes: () => ({
    list: jest.fn(),
    get: jest.fn(),
    create: createNote,
    update: jest.fn(),
    delete: jest.fn(),
  }),
}

function MockDOM(props: {
  onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
  selectionRestore?: { seq: number; verses: readonly number[] } | null
}) {
  const restoreSeq = useRef(0)
  const onVerseSelect = props.onVerseSelect
  const selectionRestore = props.selectionRestore
  useEffect(() => {
    if (selectionRestore == null || selectionRestore.seq === restoreSeq.current) {
      return
    }
    restoreSeq.current = selectionRestore.seq
    void onVerseSelect?.({
      ...lastSelection,
      verses: [...selectionRestore.verses],
    })
  }, [onVerseSelect, selectionRestore])

  return (
    <Pressable
      testID="trigger-verse-select"
      onPress={() => {
        lastSelection = mockNextVerseSelection
        void onVerseSelect?.(mockNextVerseSelection)
      }}
    >
      <Text>Select</Text>
    </Pressable>
  )
}

function MockNativeSheet({
  isOpen,
  onClose,
  onClosed,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  onClosed?: () => void
  children: ReactNode
}) {
  const wasOpen = useRef(false)
  const onClosedRef = useRef(onClosed)
  onClosedRef.current = onClosed
  const [open, setOpen] = useState(isOpen)

  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true
      setOpen(true)
      return
    }
    if (!wasOpen.current) {
      return
    }
    wasOpen.current = false
    const id = setTimeout(() => {
      setOpen(false)
      onClosedRef.current?.()
    }, 0)
    return () => clearTimeout(id)
  }, [isOpen])

  if (!open) {
    return null
  }
  return (
    <View testID="sheet">
      <Pressable testID="sheet-dismiss" onPress={onClose}>
        <Text>Dismiss</Text>
      </Pressable>
      {children}
    </View>
  )
}

const wrapper = youVersionProviderWrapper('light', undefined, hookOverrides)
const user = userEvent.setup()

function signedInWithNotes() {
  const auth = signedOutAuth({
    isAuthenticated: true,
    accessToken: 'token',
    userInfo: { id: 'user-1' },
    grantedScopes: ['read_notes', 'write_notes'],
    getAccessToken: async () => ({ status: 'ok', token: 'token', userId: 'user-1' }),
  })
  hookOverrides.useYVAuth = auth
  return auth
}

async function selectAndSave(selection: BibleReaderVerseSelection = GAPPED) {
  mockNextVerseSelection = selection
  await user.press(screen.getByTestId('trigger-verse-select'))
  await user.press(screen.getByTestId('bible-verse-action-save'))
  await screen.findByTestId('bible-note-composer')
}

beforeEach(() => {
  createNote.mockReset()
  createNote.mockResolvedValue(savedNote)
  refreshHighlights.mockClear()
  mockNextVerseSelection = GAPPED
  lastSelection = GAPPED
  hookOverrides.useYVAuth = null
  stubImpl('FootnoteContent', 'mock-footnote')
  stubImpl('BibleChapterPickerSheet', 'mock-chapter-picker-sheet')
  stubImpl('BibleVersionPickerSheet', 'mock-version-picker-sheet')
  stubImpl('BibleReaderSettingsSheet', 'mock-settings-sheet')
  stubImpl('BibleReaderSearchSheet', 'mock-search-sheet')
  stubImpl('HighlightConsentSheet', 'mock-consent-sheet')
  setImpl('BibleReaderNative', MockDOM)
  setImpl('NativeSheet', MockNativeSheet)
})

afterEach(() => {
  resetImpls()
  jest.restoreAllMocks()
})

describe('BibleReader notes composer', () => {
  it('does not start sign-in or open the composer when auth is unconfigured', async () => {
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })
    await user.press(screen.getByTestId('trigger-verse-select'))
    await user.press(screen.getByTestId('bible-verse-action-save'))

    expect(screen.getByTestId('bible-verse-action-sheet')).toBeTruthy()
    expect(screen.queryByTestId('bible-note-composer')).toBeNull()
    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
  })

  it('opens after the action sheet closes and keeps a gap in the passage', async () => {
    signedInWithNotes()
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })
    await user.press(screen.getByTestId('trigger-verse-select'))
    expect(screen.queryByTestId('bible-note-composer')).toBeNull()

    await user.press(screen.getByTestId('bible-verse-action-save'))
    await screen.findByTestId('bible-note-composer')
    expect(screen.getByTestId('bible-note-reference')).toHaveTextContent('John 1:1-2,4')
    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
  })

  it('saves a passage with no text, then a public colored note, and refreshes highlights', async () => {
    signedInWithNotes()
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })
    await selectAndSave()

    await user.press(screen.getByTestId('bible-note-save'))
    await waitFor(() => expect(createNote).toHaveBeenCalledTimes(1))
    const passageOnly = createNote.mock.calls[0]
    if (passageOnly === undefined) {
      throw new Error('expected a create')
    }
    expect(passageOnly[1]).toMatchObject({
      content: '',
      status: 'private',
      passage: { version_id: VERSION_ID, passage_id: 'JHN.1.1-2+JHN.1.4' },
    })
    expect(passageOnly[1]).not.toHaveProperty('color')
    await waitFor(() => expect(refreshHighlights).toHaveBeenCalledTimes(1))

    await selectAndSave()
    await user.press(screen.getByTestId('bible-note-visibility'))
    expect(screen.getByTestId('bible-note-visibility')).toHaveTextContent('Public')
    await user.press(screen.getByTestId('bible-note-color-ffec5b'))
    fireEvent.changeText(screen.getByTestId('bible-note-text'), 'A note')
    await user.press(screen.getByTestId('bible-note-save'))

    await waitFor(() => expect(createNote).toHaveBeenCalledTimes(2))
    const colored = createNote.mock.calls[1]
    if (colored === undefined) {
      throw new Error('expected a second create')
    }
    expect(colored[1]).toMatchObject({
      content: 'A note',
      status: 'public',
      color: 'ffec5b',
      passage: { version_id: VERSION_ID, passage_id: 'JHN.1.1-2+JHN.1.4' },
    })
  })

  it('reuses the request id after a failed save and replaces it after an edit', async () => {
    signedInWithNotes()
    createNote.mockRejectedValueOnce(new Error('down'))
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })
    await selectAndSave()

    await user.press(screen.getByTestId('bible-note-save'))
    await waitFor(() => expect(createNote).toHaveBeenCalledTimes(1))
    const failed = createNote.mock.calls[0]
    if (failed === undefined) {
      throw new Error('expected a create')
    }
    const requestId = failed[1].request_id
    expect(screen.getByTestId('bible-note-composer')).toBeTruthy()
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String), expect.any(Array)))

    createNote.mockResolvedValueOnce(savedNote)
    await user.press(screen.getByTestId('bible-note-save'))
    await waitFor(() => expect(createNote).toHaveBeenCalledTimes(2))
    const retried = createNote.mock.calls[1]
    if (retried === undefined) {
      throw new Error('expected a retry')
    }
    expect(retried[1].request_id).toBe(requestId)

    await selectAndSave()
    fireEvent.changeText(screen.getByTestId('bible-note-text'), 'Edited')
    await user.press(screen.getByTestId('bible-note-save'))
    await waitFor(() => expect(createNote).toHaveBeenCalledTimes(3))
    const edited = createNote.mock.calls[2]
    if (edited === undefined) {
      throw new Error('expected an edited create')
    }
    expect(edited[1].request_id).not.toBe(requestId)
  })

  it('asks before discarding unsaved text', async () => {
    signedInWithNotes()
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })
    await selectAndSave()
    fireEvent.changeText(screen.getByTestId('bible-note-text'), 'Keep me')
    await user.press(screen.getByTestId('bible-note-cancel'))

    await waitFor(() => expect(alert).toHaveBeenCalled())
    const buttons = alert.mock.calls[0]?.[2]
    const discard = buttons?.find((button) => button.text === 'Discard')
    expect(alert.mock.calls[0]?.[0]).toBe('Discard note?')
    expect(screen.getByTestId('bible-note-composer')).toBeTruthy()
    await act(async () => {
      discard?.onPress?.()
    })
    await waitFor(() => expect(screen.queryByTestId('bible-note-composer')).toBeNull())
  })

  it('restores the action sheet when sign-in is declined', async () => {
    const signIn = jest.fn(async () => undefined)
    hookOverrides.useYVAuth = signedOutAuth({ signIn })
    render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })
    await user.press(screen.getByTestId('trigger-verse-select'))
    await user.press(screen.getByTestId('bible-verse-action-save'))

    await screen.findByTestId('sign-in-with-youversion-sheet')
    expect(signIn).not.toHaveBeenCalled()
    await user.press(screen.getByTestId('sign-in-with-youversion-decline'))

    await screen.findByTestId('bible-verse-action-reference')
    expect(screen.getByTestId('bible-verse-action-reference')).toHaveTextContent('John 1:1-2,4')
    expect(screen.queryByTestId('bible-note-composer')).toBeNull()
  })

  it('opens the composer after sign-in grants write_notes and ignores an older attempt', async () => {
    const auth = signedOutAuth()
    let resolveFirst: (() => void) | undefined
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve
    })
    let calls = 0
    auth.signIn = jest.fn(() => {
      calls += 1
      if (calls === 1) {
        return first
      }
      auth.isAuthenticated = true
      auth.accessToken = 'token'
      auth.userInfo = { id: 'user-1' }
      auth.grantedScopes = ['read_notes', 'write_notes']
      auth.getAccessToken = async () => ({ status: 'ok', token: 'token', userId: 'user-1' })
      return Promise.resolve()
    })
    hookOverrides.useYVAuth = auth

    const view = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })
    await user.press(screen.getByTestId('trigger-verse-select'))
    await user.press(screen.getByTestId('bible-verse-action-save'))
    await screen.findByTestId('sign-in-with-youversion-sheet')
    await user.press(screen.getByTestId('sign-in-with-youversion-confirm'))
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith({ scopes: ['read_notes', 'write_notes'] }))

    view.rerender(<BibleReader book="JHN" chapter="2" versionId={VERSION_ID} />)
    resolveFirst?.()
    await waitFor(() => expect(screen.queryByTestId('bible-note-composer')).toBeNull())

    view.rerender(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />)
    await user.press(screen.getByTestId('trigger-verse-select'))
    await user.press(screen.getByTestId('bible-verse-action-save'))
    await screen.findByTestId('sign-in-with-youversion-sheet')
    await user.press(screen.getByTestId('sign-in-with-youversion-confirm'))
    await screen.findByTestId('bible-note-composer')
  })

  it('clears the composer when the account changes', async () => {
    const auth = signedInWithNotes()
    const view = render(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />, { wrapper })
    await selectAndSave()

    auth.userInfo = { id: 'user-2' }
    view.rerender(<BibleReader book="JHN" chapter="1" versionId={VERSION_ID} />)
    await waitFor(() => expect(screen.queryByTestId('bible-note-composer')).toBeNull())
  })
})
