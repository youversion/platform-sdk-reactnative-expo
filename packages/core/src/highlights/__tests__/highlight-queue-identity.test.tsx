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
import { loadTokens } from '../../auth/token-storage'
import { signInWithPKCE } from '../../auth/pkce-flow'
import YouVersionProvider from '../../youversion-provider'
import type { HighlightsApiError } from '../api'
import type { HighlightScope } from '../constants'
import { enqueueWrites, listQueuedScopes } from '../queue'
import { useHighlights } from '../use-highlights'

const mockMmkv = new Map<string, string>()

jest.mock('../../storage/mmkv-storage', () => ({
  mmkvStorage: {
    set: jest.fn((k: string, v: string) => {
      mockMmkv.set(k, v)
    }),
    getString: jest.fn((k: string) => mockMmkv.get(k)),
    remove: jest.fn((k: string) => {
      mockMmkv.delete(k)
    }),
    getAllKeys: jest.fn(() => Array.from(mockMmkv.keys())),
    has: jest.fn((k: string) => mockMmkv.has(k)),
  },
}))

const mockGetHighlights = jest.fn()
const mockCreateHighlight = jest.fn()
const mockDeleteHighlight = jest.fn()

jest.mock('../api', () => ({
  createHighlightsApi: jest.fn(() => ({
    getHighlights: mockGetHighlights,
    createHighlight: mockCreateHighlight,
    deleteHighlight: mockDeleteHighlight,
  })),
}))

jest.mock('../../auth/token-storage', () => ({
  loadTokens: jest.fn(),
  saveTokens: jest.fn(() => Promise.resolve()),
}))

jest.mock('../../auth/pkce-flow', () => ({ signInWithPKCE: jest.fn() }))
jest.mock('../../auth/http', () => ({
  ...jest.requireActual('../../auth/http'),
  refreshTokens: jest.fn(),
}))
jest.mock('../../installation-id', () => ({
  getOrSetInstallationId: jest.fn(() => Promise.resolve('install-1')),
}))
jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}))

const mockLoadTokens = loadTokens as jest.Mock
const mockSignInWithPKCE = signInWithPKCE as jest.Mock

const YELLOW = 'fffe00'
const GREEN = '5dff79'
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
  return screen.getByTestId(id).props.children
}

function painted(): string[] {
  return JSON.parse(getText('painted')) as string[]
}

/** Every token the write path and the drain have sent a highlight under. */
function tokensSent(): string[] {
  return [
    ...mockCreateHighlight.mock.calls.map(([token]) => token as string),
    ...mockDeleteHighlight.mock.calls.map(([token]) => token as string),
  ]
}

/** Signs `user` in from stored tokens, the way a relaunch does. */
function arrangeSignedIn(user: string) {
  mockMmkv.set(MMKV_AUTH_KEYS.cachedUserInfo, JSON.stringify({ id: user }))
  mockLoadTokens.mockResolvedValue({
    accessToken: `${user}-token`,
    refreshToken: `${user}-refresh`,
    expiryDate: new Date(Date.now() + 60 * 60 * 1000),
  })
}

beforeEach(() => {
  mockMmkv.clear()
  jest.clearAllMocks()
  mockGetHighlights.mockResolvedValue(collection([]))
  mockCreateHighlight.mockResolvedValue({ ok: true, value: {} })
  mockDeleteHighlight.mockResolvedValue({ ok: true, value: undefined })
  mockLoadTokens.mockResolvedValue({ accessToken: null, refreshToken: null, expiryDate: null })
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
