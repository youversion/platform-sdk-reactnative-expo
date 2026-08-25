import * as WebBrowser from 'expo-web-browser'
import type { WebBrowserAuthSessionResult } from 'expo-web-browser'

import { mmkvStorage } from '../../storage/mmkv-storage'
import { MMKV_AUTH_KEYS } from '../constants'
import { requestDataExchange, type RequestDataExchangeArgs } from '../data-exchange'
import type { DataExchangeApi } from '../data-exchange-api'
import { saveGrantedPermissions } from '../granted-permissions-cache'

const mintToken = jest.fn<
  ReturnType<DataExchangeApi['mintToken']>,
  Parameters<DataExchangeApi['mintToken']>
>()
let mockOpenAuthSession: jest.SpiedFunction<typeof WebBrowser.openAuthSessionAsync>

beforeEach(() => {
  mmkvStorage.clearAll()
  mockOpenAuthSession = jest.spyOn(WebBrowser, 'openAuthSessionAsync')
  mockOpenAuthSession.mockReset()
  mintToken.mockReset()
  mintToken.mockResolvedValue({ ok: true, value: 'dx-token' })
})

afterEach(() => {
  jest.restoreAllMocks()
})

/** The app's registered callback URL, which the consent page returns to. */
const TEST_REDIRECT_URI = 'yvp-rn-example://callback'

function run(overrides: Partial<RequestDataExchangeArgs> = {}) {
  return requestDataExchange({
    api: { mintToken },
    appKey: 'appkey',
    apiHost: 'api.example.com',
    accessToken: 'tok',
    redirectUri: TEST_REDIRECT_URI,
    initiator: { sessionId: 1, userId: 'u1' },
    permissions: ['highlights'],
    getCurrentIdentity: () => ({ sessionId: 1, userId: 'u1' }),
    ...overrides,
  })
}

function arriveWith(search: string) {
  mockOpenAuthSession.mockResolvedValue({
    type: 'success',
    url: `${TEST_REDIRECT_URI}?${search}`,
  })
}

function dismissedAuthSession(): WebBrowserAuthSessionResult {
  const result = { type: 'dismiss' }
  // SAFETY: Jest's expo-web-browser mock does not export the string enum.
  return result as WebBrowserAuthSessionResult
}

type CachedGrant = {
  userId: string
  permissions: string[]
}

function cachedGrant(): CachedGrant | undefined {
  const raw = mmkvStorage.getString(MMKV_AUTH_KEYS.grantedPermissions)
  if (raw === undefined) return undefined
  const parsed: CachedGrant = JSON.parse(raw)
  return parsed
}

describe('requestDataExchange — happy path', () => {
  it("mints, opens the hosted consent page against the app's registered callback URL, and reports the grant", async () => {
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run()

    expect(outcome).toEqual({ status: 'granted', grantedPermissions: ['highlights'] })
    expect(mintToken).toHaveBeenCalledWith('tok', ['highlights'])

    const call = mockOpenAuthSession.mock.calls[0]
    if (call === undefined) {
      throw new Error('expected openAuthSessionAsync to have been called')
    }
    // An app key has one callback URL and OAuth already owns it, so the auth
    // session must watch the app's `redirectUri`. Watching anything else means
    // the return never matches and real grants are discarded as `cancel`.
    expect(call[1]).toBe(TEST_REDIRECT_URI)
    const parsed = new URL(call[0])
    expect(parsed.origin + parsed.pathname).toBe('https://api.example.com/data-exchange')
    expect(parsed.searchParams.get('token')).toBe('dx-token')
    expect(parsed.searchParams.get('app_key')).toBe('appkey')
    expect(parsed.searchParams.get('x-yvp-app-key')).toBe('appkey')
  })

  it('merges the grant into the cache instead of replacing it', async () => {
    // A permission granted at sign-in must survive a later, narrower consent.
    saveGrantedPermissions('u1', ['votd'])
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run()

    expect(outcome).toEqual({ status: 'granted', grantedPermissions: ['highlights'] })
    expect(cachedGrant()).toEqual({ userId: 'u1', permissions: ['votd', 'highlights'] })
  })

  it('does not duplicate a permission that was already cached', async () => {
    saveGrantedPermissions('u1', ['highlights'])
    arriveWith(
      'data_exchange_status=granted&granted_permissions[]=highlights&granted_permissions[]=votd',
    )

    await run()

    expect(cachedGrant()).toEqual({ userId: 'u1', permissions: ['highlights', 'votd'] })
  })

  it('writes nothing when a granted return carries no permissions', async () => {
    // An empty list is not a denial: storing [] would fabricate one, and the
    // cache's absent state is what "unknown" means.
    arriveWith('data_exchange_status=granted&granted_permissions[]=')

    const outcome = await run()

    expect(outcome).toEqual({ status: 'granted', grantedPermissions: [] })
    expect(cachedGrant()).toBeUndefined()
  })
})

describe('requestDataExchange — cancel', () => {
  it('treats a dismissed session as a cancel and leaves the cache alone', async () => {
    // This is also what Android reports when the return never matches
    // `redirectUri`: the session hangs, then reports `dismiss`.
    saveGrantedPermissions('u1', ['votd'])
    mockOpenAuthSession.mockResolvedValue(dismissedAuthSession())

    expect(await run()).toEqual({ status: 'cancel' })
    expect(cachedGrant()).toEqual({ userId: 'u1', permissions: ['votd'] })
  })

  it('treats a cancel status on the return as a cancel and leaves the cache alone', async () => {
    saveGrantedPermissions('u1', ['votd'])
    arriveWith('data_exchange_status=cancel')

    expect(await run()).toEqual({ status: 'cancel' })
    expect(cachedGrant()).toEqual({ userId: 'u1', permissions: ['votd'] })
  })
})

describe('requestDataExchange — failure', () => {
  it('reports a mint 401 as not-permitted and never opens the browser', async () => {
    mintToken.mockResolvedValue({
      ok: false,
      error: { kind: 'not-permitted', message: 'Request failed with status 401' },
    })

    const outcome = await run()

    expect(outcome).toEqual({
      status: 'failure',
      reason: 'not-permitted',
      message: 'Request failed with status 401',
    })
    expect(mockOpenAuthSession).not.toHaveBeenCalled()
  })

  it('reports a transient mint failure as transient', async () => {
    mintToken.mockResolvedValue({
      ok: false,
      error: { kind: 'transient', status: 500, message: 'Request failed with status 500' },
    })

    expect(await run()).toEqual({
      status: 'failure',
      reason: 'transient',
      message: 'Request failed with status 500',
    })
  })

  it('reports an unknown data_exchange_status as a failure and leaves the cache alone', async () => {
    saveGrantedPermissions('u1', ['votd'])
    arriveWith('data_exchange_status=something_new&granted_permissions[]=highlights')

    const outcome = await run()

    expect(outcome).toMatchObject({ status: 'failure', reason: 'transient' })
    expect(cachedGrant()).toEqual({ userId: 'u1', permissions: ['votd'] })
  })

  it('reports a return that is not a data-exchange callback as a failure', async () => {
    arriveWith('code=AUTHCODE')

    expect(await run()).toMatchObject({ status: 'failure', reason: 'transient' })
    expect(cachedGrant()).toBeUndefined()
  })

  it('reports an unparseable return URL as a failure instead of throwing', async () => {
    mockOpenAuthSession.mockResolvedValue({ type: 'success', url: 'not a url' })

    await expect(run()).resolves.toMatchObject({ status: 'failure', reason: 'transient' })
  })

  it('reports a rejecting auth session as a failure instead of throwing', async () => {
    // `openAuthSessionAsync` rejects on conditions a user can reach: a session
    // already open (a double-tap), a missing native module, or an Android build
    // with no activity able to handle the intent. This flow promises an outcome,
    // and every doc for it tells consumers not to try/catch.
    saveGrantedPermissions('u1', ['votd'])
    mockOpenAuthSession.mockRejectedValue(
      new Error('WebBrowser is already open, only one can be open at a time'),
    )

    await expect(run()).resolves.toEqual({
      status: 'failure',
      reason: 'transient',
      message: 'WebBrowser is already open, only one can be open at a time',
    })
    expect(cachedGrant()).toEqual({ userId: 'u1', permissions: ['votd'] })
  })

  it('reports a non-Error rejection from the auth session as a failure', async () => {
    mockOpenAuthSession.mockRejectedValue('exploded')

    await expect(run()).resolves.toEqual({
      status: 'failure',
      reason: 'transient',
      message: 'exploded',
    })
  })
})

describe('requestDataExchange — initiator guard', () => {
  it('discards the grant and fails when the signed-in user changed mid-flow', async () => {
    saveGrantedPermissions('u1', ['votd'])
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run({ getCurrentIdentity: () => ({ sessionId: 2, userId: 'u2' }) })

    expect(outcome).toMatchObject({ status: 'failure', reason: 'user-changed' })
    // Neither user's cache was written: u1's entry is untouched, and nothing
    // was recorded for u2.
    expect(cachedGrant()).toEqual({ userId: 'u1', permissions: ['votd'] })
  })

  it('fails when the user signed out mid-flow', async () => {
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run({ getCurrentIdentity: () => ({ sessionId: 2, userId: null }) })

    expect(outcome).toMatchObject({ status: 'failure', reason: 'user-changed' })
    expect(cachedGrant()).toBeUndefined()
  })

  it('accepts a grant for a signed-in user with no id, rather than failing closed forever', async () => {
    // `userInfo.id` comes from the id_token's `sub` and can legitimately be
    // absent; treating that as a mismatch would make the flow unusable.
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run({
      initiator: { sessionId: 1, userId: null },
      getCurrentIdentity: () => ({ sessionId: 1, userId: null }),
    })

    expect(outcome).toEqual({ status: 'granted', grantedPermissions: ['highlights'] })
    // Granted, but not persisted: the cache refuses a null userId (an entry no
    // user can be identified by would be read back by every id-less user — see
    // granted-permissions-cache.ts). The provider still merges the outcome into
    // in-memory state, so hasPermission is true for the rest of the session and
    // the next cold start re-prompts rather than trusting an unattributable entry.
    expect(cachedGrant()).toBeUndefined()
  })

  it('discards an id-less user’s grant when the session changed mid-flow', async () => {
    // The case the session id exists to catch: comparing ids alone, `null === null`
    // waves this through and the caller is told `granted` for a user who has
    // left. Nothing would be persisted either way — the cache refuses a null
    // userId — but the outcome itself must not lie.
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run({
      initiator: { sessionId: 1, userId: null },
      getCurrentIdentity: () => ({ sessionId: 3, userId: null }),
    })

    expect(outcome).toMatchObject({ status: 'failure', reason: 'user-changed' })
    expect(cachedGrant()).toBeUndefined()
  })

  it('accepts a grant when only the token changed mid-flow', async () => {
    // A refresh issues a new token for the same person and leaves the session
    // id alone, so it must not fail the guard.
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run({
      initiator: { sessionId: 4, userId: 'u1' },
      getCurrentIdentity: () => ({ sessionId: 4, userId: 'u1' }),
    })

    expect(outcome).toEqual({ status: 'granted', grantedPermissions: ['highlights'] })
    expect(cachedGrant()).toEqual({ userId: 'u1', permissions: ['highlights'] })
  })
})
