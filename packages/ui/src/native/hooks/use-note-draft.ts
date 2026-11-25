import {
  useNotes,
  useYouVersion,
  useYVAuthOptional,
  type AuthScope,
  type CreateNote,
  type HighlightScope,
} from '@youversion/platform-react-native-expo-core'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'

import { useSdkTranslation } from '../../i18n/use-sdk-translation'
import {
  noteFlowReducer,
  notePassageId,
  type NoteAccount,
  type NoteAuthGate,
  type NoteDraft,
  type NoteFlow,
  type NoteFlowEvent,
  type NoteVisibility,
} from '../../lib/note-draft'
import type { BibleReaderVerseRange } from '../../types/verse-hook-types'

const NOTE_SCOPES = ['read_notes', 'write_notes'] as const satisfies readonly AuthScope[]

type StartInput = {
  ranges: readonly BibleReaderVerseRange[]
  title: string
  verses: readonly number[]
}

function accountFrom(
  userId: string | undefined,
  signedIn: boolean,
  appKey: string,
  apiHost: string,
): NoteAccount | null {
  if (!signedIn || userId === undefined || userId.length === 0) {
    return null
  }
  return { userId, appKey, apiHost }
}

type NoteDraftController = {
  draft: NoteDraft | null
  composing: boolean
  saving: boolean
  signInPromptOpen: boolean
  restore: { seq: number; verses: readonly number[] } | null
  start: (input: StartInput) => boolean
  confirmSignIn: () => Promise<void>
  cancelSignIn: () => void
  setText: (text: string) => void
  setVisibility: (visibility: NoteVisibility) => void
  setColor: (color: string | null) => void
  save: () => Promise<void>
  requestDismiss: () => void
}

export function useNoteDraft(options: {
  gate: NoteAuthGate
  scope: HighlightScope
  refreshHighlights: () => Promise<void>
}): NoteDraftController {
  const { gate, scope, refreshHighlights } = options
  const auth = useYVAuthOptional()
  const { appKey, apiHost } = useYouVersion()
  const notes = useNotes()
  const { t } = useSdkTranslation()
  const [flow, setFlow] = useState<NoteFlow>({ status: 'idle' })
  const flowRef = useRef(flow)
  const authRef = useRef(auth)
  authRef.current = auth
  const [restore, setRestore] = useState<{ seq: number; verses: readonly number[] } | null>(null)
  const restoreSeq = useRef(0)
  const renderWaiters = useRef<Array<() => void>>([])
  const [, bumpRender] = useState(0)

  const userId = auth?.userInfo?.id
  const signedIn = auth?.isAuthenticated ?? false
  const account = useMemo(
    () => accountFrom(userId, signedIn, appKey, apiHost),
    [userId, signedIn, appKey, apiHost],
  )
  const hasWriteNotes = auth?.grantedScopes?.includes('write_notes') ?? false

  const send = useCallback((event: NoteFlowEvent) => {
    const result = noteFlowReducer(flowRef.current, event, () => crypto.randomUUID())
    flowRef.current = result.flow
    setFlow(result.flow)
    if (result.restoreVerses !== null) {
      restoreSeq.current += 1
      setRestore({ seq: restoreSeq.current, verses: result.restoreVerses })
    }
    return result
  }, [])

  useEffect(() => {
    const waiters = renderWaiters.current
    renderWaiters.current = []
    for (const resolve of waiters) {
      resolve()
    }
  })

  const nextRender = useCallback(
    () =>
      new Promise<void>((resolve) => {
        renderWaiters.current.push(resolve)
        bumpRender((count) => count + 1)
      }),
    [],
  )

  const runSignIn = useCallback(async () => {
    const attemptId = crypto.randomUUID()
    const begun = send({ type: 'begin-sign-in', attemptId })
    if (begun.flow.status !== 'needs-auth' || begun.flow.attemptId !== attemptId) {
      return
    }
    const current = authRef.current
    if (current === null) {
      send({ type: 'sign-in-cancelled', attemptId })
      return
    }
    try {
      await current.signIn({ scopes: NOTE_SCOPES })
    } catch {
      send({
        type: 'sign-in-finished',
        attemptId,
        grantedWriteNotes: false,
        account: null,
      })
      return
    }
    await nextRender()
    const after = authRef.current
    send({
      type: 'sign-in-finished',
      attemptId,
      grantedWriteNotes: after?.grantedScopes?.includes('write_notes') ?? false,
      account: accountFrom(after?.userInfo?.id, after?.isAuthenticated ?? false, appKey, apiHost),
    })
  }, [apiHost, appKey, nextRender, send])

  useEffect(() => {
    send({ type: 'auth-settled', gate, hasWriteNotes, account })
  }, [account, gate, hasWriteNotes, send])

  useEffect(() => {
    send({ type: 'account-changed', account })
  }, [account, send])

  useEffect(() => {
    const current = flowRef.current
    if (current.status === 'idle') {
      return
    }
    const range = current.draft.ranges[0]
    if (range === undefined) {
      return
    }
    if (
      range.versionId !== scope.versionId ||
      range.book !== scope.book ||
      range.chapter !== scope.chapter
    ) {
      send({ type: 'left-passage' })
    }
  }, [scope, send])

  useEffect(() => {
    if (flow.status !== 'needs-auth' || flow.attemptId !== '' || gate !== 'ready' || hasWriteNotes) {
      return
    }
    void runSignIn()
  }, [flow, gate, hasWriteNotes, runSignIn])

  const saveError = flow.status === 'composing' && flow.saveError
  const confirmDiscard = flow.status === 'composing' && flow.confirmDiscard

  useEffect(() => {
    if (!saveError) {
      return
    }
    Alert.alert(t('error'), t('generic.requestErrorBody'), [
      { text: t('ok'), onPress: () => send({ type: 'dismiss-error' }) },
    ])
  }, [saveError, send, t])

  useEffect(() => {
    if (!confirmDiscard) {
      return
    }
    Alert.alert(t('notesDiscardTitle'), t('notesDiscardMessage'), [
      { text: t('cancel'), onPress: () => send({ type: 'keep-editing' }) },
      { text: t('notesDiscard'), style: 'destructive', onPress: () => send({ type: 'confirm-discard' }) },
    ])
  }, [confirmDiscard, send, t])

  const start = useCallback(
    (input: StartInput) => {
      const passageId = notePassageId(input.ranges)
      const first = input.ranges[0]
      if (passageId === null || first === undefined) {
        return false
      }
      const result = send({
        type: 'start',
        gate,
        hasWriteNotes,
        account,
        draft: {
          ranges: input.ranges,
          title: input.title,
          versionId: first.versionId,
          passageId,
          verses: input.verses,
          text: '',
          visibility: 'private',
          color: null,
          requestId: crypto.randomUUID(),
          account: null,
        },
      })
      return result.flow.status !== 'idle'
    },
    [account, gate, hasWriteNotes, send],
  )

  const save = useCallback(async () => {
    const current = flowRef.current
    if (current.status !== 'composing' || current.saving) {
      return
    }
    const { draft } = current
    send({ type: 'save-started' })
    try {
      const token = await authRef.current?.getAccessToken()
      if (token === undefined || token.status !== 'ok') {
        send({ type: 'save-failed' })
        return
      }
      if (draft.account !== null && token.userId !== draft.account.userId) {
        send({ type: 'account-changed', account: null })
        return
      }
      const body: CreateNote = {
        request_id: draft.requestId,
        content: draft.text,
        status: draft.visibility,
        passage: { version_id: draft.versionId, passage_id: draft.passageId },
      }
      if (draft.color !== null) {
        body.color = draft.color
      }
      await notes.create(token.token, body)
      send({ type: 'save-succeeded' })
      void refreshHighlights()
    } catch {
      send({ type: 'save-failed' })
    }
  }, [notes, refreshHighlights, send])

  const draft: NoteDraft | null = flow.status === 'idle' ? null : flow.draft
  const signInPromptOpen =
    flow.status === 'needs-auth' && flow.attemptId === '' && gate === 'signed-out'

  return {
    draft,
    composing: flow.status === 'composing',
    saving: flow.status === 'composing' && flow.saving,
    signInPromptOpen,
    restore,
    start,
    confirmSignIn: runSignIn,
    cancelSignIn: (): void => {
      const current = flowRef.current
      const attemptId = current.status === 'needs-auth' ? current.attemptId : ''
      send({ type: 'sign-in-cancelled', attemptId })
    },
    setText: (text: string): void => {
      send({ type: 'set-text', text })
    },
    setVisibility: (visibility: NoteVisibility): void => {
      send({ type: 'set-visibility', visibility })
    },
    setColor: (color: string | null): void => {
      send({ type: 'set-color', color })
    },
    save,
    requestDismiss: (): void => {
      send({ type: 'request-dismiss' })
    },
  }
}
