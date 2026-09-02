/**
 * Identity seam for the Highlight Write Queue: whose writes these are.
 *
 * Real provider, real sign-out routine, real queue and drain. Only MMKV, the
 * highlights API and the auth edges are faked, so the assertions are about what
 * reached the API and what a mounted reader paints.
 */

import type { Collection, Highlight } from '@youversion/platform-core'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { Pressable, Text, View } from 'react-native'

import { useYVAuth } from '../../auth'
import type { Result } from '../../result'
import { MMKV_AUTH_KEYS } from '../../auth/constants'
import * as tokenStorage from '../../auth/token-storage'
import * as pkceFlow from '../../auth/pkce-flow'
import * as http from '../../auth/http'
import * as installationId from '../../installation-id'
import { mmkvStorage } from '../../storage/mmkv-storage'
import YouVersionProvider from '../../youversion-provider'
import * as api from '../api'
import type { HighlightsApiError } from '../api'
import type { HighlightScope } from '../constants'
import { enqueueWrites, listQueuedScopes } from '../queue'
import { useHighlights } from '../use-highlights'

const mockGetHighlights = jest.fn()
const mockCreateHighlight = jest.fn()
const mockDeleteHighlight = jest.fn()

let mockLoadTokens: jest.SpiedFunction<typeof tokenStorage.loadTokens>
let mockSignInWithPKCE: jest.SpiedFunction<typeof pkceFlow.signInWithPKCE>

const YELLOW = 'ffec5b'
const GREEN = 'b4ffc1'
const scope: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }
const authConfig = { redirectUri: 'https://app/cb', permissions: ['highlights' as const] }

/** No response at all — the write parks rather than reverting. */
const unreachable = (): Result<never, HighlightsApiError> => ({
  ok: false,
  error: { kind: 'transient', message: 'Network request failed' },
})

function collection(data: Highlight[]): Result<Collection<Highlight>, HighlightsApiError> {
  return { ok: true, value: { data, next_page_token: null } }
}

function tokensFor(user: string) {
  return {
    access_token: `${user}-token`,
    refresh_token: `${user}-refresh`,
    expires_in: '3600',
    token_type: 'Bearer',
  }
}

function Harness() {
  const auth = useYVAuth()
  const highlights = useHighlights(scope)

  return (
    <View>
      <Text testID="userId">{auth.userInfo?.id ?? 'none'}</Text>
      <Text testID="painted">
        {JSON.stringify(highlights.highlights.map((h) => `${h.passage_id}:${h.color}`))}
      </Text>
      <Pressable
        testID="apply"
        onPress={() => {
          void highlights.apply(YELLOW, [16])
        }}
      >
        <Text>apply</Text>
      </Pressable>
      <Pressable testID="signOut" onPress={() => auth.signOut()}>
        <Text>signOut</Text>
      </Pressable>
      <Pressable testID="signIn" onPress={() => auth.signIn()}>
        <Text>signIn</Text>
      </Pressable>
    </View>
  )
}

function renderApp() {
  return render(
    <YouVersionProvider appKey="app-key" auth={authConfig}>
      <Harness />
    </YouVersionProvider>,
  )
}

function getText(id: string): string {
  const children = screen.getByTestId(id).props.children
  return Array.isArray(children) ? children.join('') : String(children ?? '')
}

function painted(): string[] {
  const parsed: string[] = JSON.parse(getText('painted'))
  return parsed
}

/** Every token the write path and the drain have sent a highlight under. */
function tokensSent(): string[] {
  return [
    ...mockCreateHighlight.mock.calls.map(([token]) => token),
    ...mockDeleteHighlight.mock.calls.map(([token]) => token),
  ]
}

/** Signs `user` in from stored tokens, the way a relaunch does. */
function arrangeSignedIn(user: string) {
  mmkvStorage.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify({ id: user }))
  mockLoadTokens.mockResolvedValue({
    accessToken: `${user}-token`,
    refreshToken: `${user}-refresh`,
    expiryDate: new Date(Date.now() + 60 * 60 * 1000),
  })
}

beforeEach(() => {
  mmkvStorage.clearAll()
  mockGetHighlights.mockReset()
  mockCreateHighlight.mockReset()
  mockDeleteHighlight.mockReset()
  mockGetHighlights.mockResolvedValue(collection([]))
  mockCreateHighlight.mockResolvedValue({ ok: true, value: {} })
  mockDeleteHighlight.mockResolvedValue({ ok: true, value: undefined })

  jest.spyOn(api, 'createHighlightsApi').mockReturnValue({
    getHighlights: mockGetHighlights,
    createHighlight: mockCreateHighlight,
    deleteHighlight: mockDeleteHighlight,
  })
  mockLoadTokens = jest.spyOn(tokenStorage, 'loadTokens').mockResolvedValue({
    accessToken: null,
    refreshToken: null,
    expiryDate: null,
  })
  jest.spyOn(tokenStorage, 'saveTokens').mockResolvedValue(undefined)
  mockSignInWithPKCE = jest.spyOn(pkceFlow, 'signInWithPKCE')
  jest.spyOn(http, 'refreshTokens')
  jest.spyOn(installationId, 'getOrSetInstallationId').mockReturnValue('install-1')
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('a queued write and the user who made it', () => {
  it('never lands on the account of whoever signs in next', async () => {
    const user = userEvent.setup()
    arrangeSignedIn('user-1')
    mockCreateHighlight.mockResolvedValue(unreachable())

    renderApp()
    await waitFor(() => expect(getText('userId')).toBe('user-1'))
    await user.press(screen.getByTestId('apply'))
    await waitFor(() => expect(listQueuedScopes('user-1')).toEqual([scope]))

    await user.press(screen.getByTestId('signOut'))
    await waitFor(() => expect(getText('userId')).toBe('none'))

    mockCreateHighlight.mockResolvedValue({ ok: true, value: {} })
    mockSignInWithPKCE.mockResolvedValue({
      kind: 'success',
      tokens: tokensFor('user-2'),
      userInfo: { id: 'user-2' },
      grantedPermissions: ['highlights'],
    })
    await user.press(screen.getByTestId('signIn'))
    await waitFor(() => expect(getText('userId')).toBe('user-2'))

    expect(tokensSent()).toEqual(['user-1-token'])
    expect(listQueuedScopes('user-1')).toEqual([])
    expect(listQueuedScopes('user-2')).toEqual([])
    expect(painted()).toEqual([])
  })

  it('is gone from storage the moment they sign out, paint included', async () => {
    const user = userEvent.setup()
    arrangeSignedIn('user-1')
    mockCreateHighlight.mockResolvedValue(unreachable())

    renderApp()
    await waitFor(() => expect(getText('userId')).toBe('user-1'))
    await user.press(screen.getByTestId('apply'))
    await waitFor(() => expect(painted()).toEqual([`JHN.3.16:${YELLOW}`]))

    await user.press(screen.getByTestId('signOut'))

    await waitFor(() => expect(listQueuedScopes('user-1')).toEqual([]))
    expect(painted()).toEqual([])
  })

  it('stays scoped to them while another user has entries for the same chapter', async () => {
    arrangeSignedIn('user-1')
    enqueueWrites({ userId: 'user-2', scope, verses: [1], color: GREEN, currentColors: {} })
    enqueueWrites({ userId: 'user-1', scope, verses: [16], color: YELLOW, currentColors: {} })

    renderApp()
    await waitFor(() => expect(getText('userId')).toBe('user-1'))

    // Only their own verse is painted, and only their own verse is drained.
    expect(painted()).toEqual([`JHN.3.16:${YELLOW}`])
    await waitFor(() =>
      expect(mockCreateHighlight.mock.calls).toEqual([
        ['user-1-token', { version_id: 111, passage_id: 'JHN.3.16', color: YELLOW }],
      ]),
    )
    expect(listQueuedScopes('user-2')).toEqual([scope])
  })
})
