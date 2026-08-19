/**
 * Layer 3 — the two prompts that stand between a swatch press and a write.
 *
 * The reader owns the sign-in pre-step (the Permission Flow has no sign-in
 * prompt state of its own, so `highlightPermissionFlow.apply` would launch
 * OAuth unannounced), and the flow owns the consent step via `isConfirming`.
 * The invariant across both: exactly one sheet is active, so a prompt never
 * displaces the action sheet and fires `closeVerseActions` as a side effect.
 */
import type {
  AuthContextValue,
  Highlight,
  HookOverrides,
  UseHighlightsOptions,
} from '@youversion/platform-react-native-expo-core'
import { act, render, screen, userEvent } from '@testing-library/react-native'
import type { BibleReaderShareData, BibleReaderVerseSelection } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import {
  readerLocationStoreInitialState,
  useReaderLocationStore,
} from '../../stores/reader-location-store'
import {
  defaultHookOverrides,
  emptyHighlights,
  signedOutAuth,
} from '../../test-utils/default-hook-overrides'
import {
  resetImpls,
  setImpl,
  stubImpl,
} from '../../test-utils/install-test-impls'
import { YouVersionProvider } from '../youversion-provider'
import { BibleReader } from '../bible-reader'

const VERSION_ID = 111

const SHARE_DATA: BibleReaderShareData = {
  text: '“In the beginning was the Word...”\n\nJohn 1:1-2 BSB',
  reference: 'John 1:1-2 BSB',
  verseText: '“In the beginning was the Word...”',
  verses: [1, 2],
  book: 'JHN',
  chapter: '1',
  versionId: VERSION_ID,
}

const SELECTION: BibleReaderVerseSelection = {
  versionId: VERSION_ID,
  book: 'JHN',
  chapter: '1',
  verses: [1, 2],
  passageIds: ['JHN.1.1', 'JHN.1.2'],
  reference: 'John 1:1-2',
  shareData: SHARE_DATA,
}

const GREEN = '5dff79'
const BLUE = '00d6ff'

function highlight(verse: number, color: string): Highlight {
  return { version_id: VERSION_ID, passage_id: `JHN.1.${verse}`, color }
}

const highlightPermissionFlowApply = jest.fn(async () => ({ status: 'noop' }) as const)
const highlightPermissionFlowConfirm = jest.fn()
const highlightPermissionFlowDecline = jest.fn()
const rawApply = jest.fn(async () => ({ status: 'noop' }) as const)
const rawRemove = jest.fn(async () => ({ status: 'noop' }) as const)

let permissionHighlights: Highlight[] = []
let permissionIsConfirming = false

type PermissionFlowStub = {
  highlights?: Highlight[]
  isConfirming?: boolean
}

function stubHighlightPermissionFlow({
  highlights = [],
  isConfirming = false,
}: PermissionFlowStub = {}) {
  permissionHighlights = highlights
  permissionIsConfirming = isConfirming
}

function useHighlightPermissionFlow({ versionId, book, chapter }: UseHighlightsOptions) {
  return {
    highlights: {
      ...emptyHighlights({ versionId, book, chapter }),
      highlights: permissionHighlights,
      apply: rawApply,
      remove: rawRemove,
    },
    isConfirming: permissionIsConfirming,
    apply: highlightPermissionFlowApply,
    confirm: highlightPermissionFlowConfirm,
    decline: highlightPermissionFlowDecline,
    flowError: null,
  }
}

function authValue(isAuthenticated: boolean, isLoading = false): AuthContextValue {
  return signedOutAuth({
    isAuthenticated,
    accessToken: isAuthenticated ? 'test-token' : null,
    isLoading,
    requestedPermissions: ['highlights'],
    getAccessToken: async () =>
      isAuthenticated
        ? ({ status: 'ok', token: 'test-token', userId: null } as const)
        : ({ status: 'unavailable', reason: 'signed-out' } as const),
  })
}

let mockNextVerseSelection: BibleReaderVerseSelection = SELECTION

function MockDOM(props: {
  onVerseSelect?: (verseSelection: BibleReaderVerseSelection) => Promise<void>
}) {
  return (
    <View testID="mock-dom">
      <Pressable
        testID="trigger-verse-select"
        onPress={() => void props.onVerseSelect?.(mockNextVerseSelection)}
      >
        <Text>Select</Text>
      </Pressable>
    </View>
  )
}

/**
 * Same stand-in as the verse-action suite. `sheet-dismiss` is every
 * non-button exit — swipe-down, backdrop tap, and displacement by another sheet
 * all land on `NativeSheet`'s single `onClose`.
 *
 * Because each open sheet renders one `sheet` testID, counting them is how these
 * tests assert "one sheet at a time".
 */
function MockNativeSheet({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}) {
  return isOpen ? (
    <View testID="sheet">
      <Pressable testID="sheet-dismiss" onPress={onClose}>
        <Text>Dismiss</Text>
      </Pressable>
      {children}
    </View>
  ) : null
}

function readerHookOverrides(auth: AuthContextValue | null): HookOverrides {
  return {
    ...defaultHookOverrides,
    useYVAuth: auth,
    useHighlightPermissionFlow,
  }
}

function ReaderHarness({
  auth,
  book = 'JHN',
  chapter = '1',
  versionId = VERSION_ID,
}: {
  auth: AuthContextValue | null
  book?: string
  chapter?: string
  versionId?: number
}) {
  return (
    <YouVersionProvider appKey="test-key" theme="light" hookOverrides={readerHookOverrides(auth)}>
      <BibleReader book={book} chapter={chapter} versionId={versionId} />
    </YouVersionProvider>
  )
}

const user = userEvent.setup()

async function selectVerses(verseSelection: BibleReaderVerseSelection = SELECTION) {
  mockNextVerseSelection = verseSelection
  await user.press(screen.getByTestId('trigger-verse-select'))
}

async function press(testID: string) {
  await user.press(screen.getByTestId(testID))
}

function openSheetCount() {
  return screen.queryAllByTestId('sheet').length
}

beforeEach(() => {
  mockNextVerseSelection = SELECTION
  highlightPermissionFlowApply.mockClear()
  highlightPermissionFlowConfirm.mockClear()
  highlightPermissionFlowDecline.mockClear()
  rawApply.mockClear()
  rawRemove.mockClear()
  stubHighlightPermissionFlow()
  stubImpl('FootnoteContent', 'mock-footnote')
  stubImpl('BibleChapterPickerSheet', 'mock-chapter-picker-sheet')
  stubImpl('BibleVersionPickerSheet', 'mock-version-picker-sheet')
  stubImpl('BibleReaderSettingsSheet', 'mock-settings-sheet')
  setImpl('BibleReaderDom', MockDOM)
  setImpl('NativeSheet', MockNativeSheet)
  useReaderLocationStore.setState(readerLocationStoreInitialState)
})

afterEach(() => {
  resetImpls()
  jest.restoreAllMocks()
})

describe('BibleReader — the sign-in pre-step', () => {
  it('trades the action sheet for the sign-in sheet, one at a time', async () => {
    render(<ReaderHarness auth={authValue(false)} />)

    await selectVerses()
    expect(screen.getByTestId('bible-verse-action-sheet')).toBeTruthy()

    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(screen.getByTestId('sign-in-with-youversion-sheet')).toBeTruthy()
    // Two live sheets means the loser was displaced, and displacement fires
    // `closeVerseActions` — which would bump the clear signal underneath a
    // prompt that has not been answered yet.
    expect(openSheetCount()).toBe(1)
  })

  it('writes nothing until the user says yes', async () => {
    render(<ReaderHarness auth={authValue(false)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
    expect(rawApply).not.toHaveBeenCalled()
  })

  it('replays the stashed intent through the flow on confirm', async () => {
    render(<ReaderHarness auth={authValue(false)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)
    await press('sign-in-with-youversion-confirm')

    // The color and verses survive the round-trip: the user does not reselect.
    expect(highlightPermissionFlowApply).toHaveBeenCalledWith(GREEN, [1, 2])
    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
  })

  it('discards the intent on "No Thanks"', async () => {
    render(<ReaderHarness auth={authValue(false)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)
    await press('sign-in-with-youversion-decline')

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
    expect(rawApply).not.toHaveBeenCalled()
    expect(openSheetCount()).toBe(0)
  })

  it('discards the intent on a swipe-down or backdrop tap too', async () => {
    render(<ReaderHarness auth={authValue(false)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)
    await press('sheet-dismiss')

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
  })

  it('leaves a dismissed intent behind — a later press starts over', async () => {
    render(<ReaderHarness auth={authValue(false)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)
    await press('sign-in-with-youversion-decline')

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${BLUE}`)
    await press('sign-in-with-youversion-confirm')

    // The green intent is gone, not queued behind the blue one.
    expect(highlightPermissionFlowApply).toHaveBeenCalledTimes(1)
    expect(highlightPermissionFlowApply).toHaveBeenCalledWith(BLUE, [1, 2])
  })

  /**
   * The pending intent outlives the selection, but verse numbers alone are not
   * a passage. A controlled consumer can change book / chapter / versionId
   * while the sign-in sheet is open; replaying the old verses through the new
   * location-scoped flow would paint text the user never selected — the same
   * bug ADR 0016 pins inside the Permission Flow.
   */
  /**
   * All three scope fields, because the prompt's scope is compared field by
   * field — a comparison that dropped `versionId` or `book` would still pass a
   * chapter-only case.
   */
  it.each([
    ['chapter', { book: 'JHN', chapter: '2', versionId: VERSION_ID }],
    ['book', { book: 'LUK', chapter: '1', versionId: VERSION_ID }],
    ['versionId', { book: 'JHN', chapter: '1', versionId: 206 }],
  ])('discards the intent when %s changes while the prompt is up', async (_field, next) => {
    const { rerender } = render(<ReaderHarness auth={authValue(false)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)
    expect(screen.getByTestId('sign-in-with-youversion-sheet')).toBeTruthy()

    await act(async () => {
      rerender(
        <ReaderHarness
          auth={authValue(false)}
          book={next.book}
          chapter={next.chapter}
          versionId={next.versionId}
        />,
      )
    })

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
    expect(rawApply).not.toHaveBeenCalled()
  })

  it('keeps the intent when the reader stays in the same passage', async () => {
    const { rerender } = render(<ReaderHarness auth={authValue(false)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    // An unrelated re-render must not trip the discard — `NO_PROMPT`'s stable
    // identity is what keeps this from closing on every frame.
    await act(async () => {
      rerender(<ReaderHarness auth={authValue(false)} />)
    })

    expect(screen.getByTestId('sign-in-with-youversion-sheet')).toBeTruthy()
    await press('sign-in-with-youversion-confirm')
    expect(highlightPermissionFlowApply).toHaveBeenCalledWith(GREEN, [1, 2])
  })

  it('never prompts for a remove', async () => {
    stubHighlightPermissionFlow({ highlights: [highlight(1, BLUE), highlight(2, BLUE)] })
    render(<ReaderHarness auth={authValue(false)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-remove-${BLUE}`)

    // ADR 0016: a user looking at their own highlight already has whatever the
    // write needs, so removal skips both prompts.
    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(screen.queryByTestId('highlight-consent-sheet')).toBeNull()
    expect(rawRemove).toHaveBeenCalledWith(BLUE, [1, 2])
  })

  it('holds the tap while auth is still loading', async () => {
    render(<ReaderHarness auth={authValue(false, true)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
  })

  it('opens sign-in once bootstrap settles signed out', async () => {
    const { rerender } = render(<ReaderHarness auth={authValue(false, true)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    await act(async () => {
      rerender(<ReaderHarness auth={authValue(false)} />)
    })

    expect(screen.getByTestId('sign-in-with-youversion-sheet')).toBeTruthy()
    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
  })

  it('applies once bootstrap settles signed in', async () => {
    const { rerender } = render(<ReaderHarness auth={authValue(false, true)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    await act(async () => {
      rerender(<ReaderHarness auth={authValue(true)} />)
    })

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(highlightPermissionFlowApply).toHaveBeenCalledWith(GREEN, [1, 2])
  })

  it('drops a held tap when the user selects different verses', async () => {
    const { rerender } = render(<ReaderHarness auth={authValue(false, true)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    await selectVerses({
      ...SELECTION,
      verses: [3],
      passageIds: ['JHN.1.3'],
      reference: 'John 1:3',
    })

    await act(async () => {
      rerender(<ReaderHarness auth={authValue(false)} />)
    })

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
  })

  it('keeps a held tap when the action sheet clears the selection', async () => {
    const { rerender } = render(<ReaderHarness auth={authValue(false, true)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)
    await selectVerses({ ...SELECTION, verses: [], passageIds: [], reference: '' })

    await act(async () => {
      rerender(<ReaderHarness auth={authValue(false)} />)
    })

    expect(screen.getByTestId('sign-in-with-youversion-sheet')).toBeTruthy()
    expect(highlightPermissionFlowApply).not.toHaveBeenCalled()
  })

  it('goes straight to the flow for a signed-in user', async () => {
    render(<ReaderHarness auth={authValue(true)} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(highlightPermissionFlowApply).toHaveBeenCalledWith(GREEN, [1, 2])
  })

  /**
   * No `auth` config is not "signed out" — there is nothing to sign in to, and
   * the flow's own `apply` warns and falls through to the unguarded write. A
   * prompt here would open a sheet whose only outcome is the one the user
   * already had.
   */
  it('does not prompt a consumer who configured no auth', async () => {
    render(<ReaderHarness auth={null} />)

    await selectVerses()
    await press(`bible-verse-action-swatch-apply-${GREEN}`)

    expect(screen.queryByTestId('sign-in-with-youversion-sheet')).toBeNull()
    expect(highlightPermissionFlowApply).toHaveBeenCalledWith(GREEN, [1, 2])
  })
})

describe('BibleReader — the consent step', () => {
  it('opens on isConfirming and closes the action sheet with it', async () => {
    stubHighlightPermissionFlow({ isConfirming: true })
    render(<ReaderHarness auth={authValue(true)} />)

    await selectVerses()

    expect(screen.getByTestId('highlight-consent-sheet')).toBeTruthy()
    expect(screen.queryByTestId('bible-verse-action-sheet')).toBeNull()
    expect(openSheetCount()).toBe(1)
  })

  it('hands Continue to confirm()', async () => {
    stubHighlightPermissionFlow({ isConfirming: true })
    render(<ReaderHarness auth={authValue(true)} />)

    await press('highlight-consent-confirm')

    expect(highlightPermissionFlowConfirm).toHaveBeenCalledTimes(1)
    expect(highlightPermissionFlowDecline).not.toHaveBeenCalled()
  })

  it('hands Cancel to decline()', async () => {
    stubHighlightPermissionFlow({ isConfirming: true })
    render(<ReaderHarness auth={authValue(true)} />)

    await press('highlight-consent-cancel')

    expect(highlightPermissionFlowDecline).toHaveBeenCalledTimes(1)
    expect(highlightPermissionFlowConfirm).not.toHaveBeenCalled()
  })

  /**
   * The backdrop tap, the pan-down, and displacement by another sheet are one
   * handler on `NativeSheet`. A path that skipped `decline()` would strand the
   * flow with `isConfirming` still true and no sheet on screen.
   */
  it('hands the backdrop, pan-down and displacement paths to decline()', async () => {
    stubHighlightPermissionFlow({ isConfirming: true })
    render(<ReaderHarness auth={authValue(true)} />)

    await press('sheet-dismiss')

    expect(highlightPermissionFlowDecline).toHaveBeenCalledTimes(1)
    expect(highlightPermissionFlowConfirm).not.toHaveBeenCalled()
  })
})
