import * as WebBrowser from 'expo-web-browser'

import { MMKV_AUTH_KEYS } from '../constants'
import {
  DATA_EXCHANGE_RETURN_URL,
  requestDataExchange,
  type RequestDataExchangeArgs,
} from '../data-exchange'
import type { DataExchangeApi } from '../data-exchange-api'
import { saveGrantedPermissions } from '../granted-permissions'

const mockMmkv = new Map<string, string>()

jest.mock('../../storage/mmkv-storage', () => ({
  mmkvStorage: {
    set: jest.fn((k: string, v: string) => {
      mockMmkv.set(k, v)
    }),
    getString: jest.fn((k: string) => mockMmkv.get(k)),
    remove: jest.fn((k: string) => mockMmkv.delete(k)),
    getAllKeys: jest.fn(() => Array.from(mockMmkv.keys())),
  },
}))

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}))

const mockOpenAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock
const mintToken = jest.fn<ReturnType<DataExchangeApi['mintToken']>, unknown[]>()

beforeEach(() => {
  mockMmkv.clear()
  jest.clearAllMocks()
  mintToken.mockResolvedValue({ ok: true, value: 'dx-token' })
})

function run(overrides: Partial<RequestDataExchangeArgs> = {}) {
  return requestDataExchange({
    api: { mintToken } as DataExchangeApi,
    appKey: 'appkey',
    apiHost: 'api.example.com',
    accessToken: 'tok',
    initiator: { epoch: 1, userId: 'u1' },
    permissions: ['highlights'],
    getCurrentIdentity: () => ({ epoch: 1, userId: 'u1' }),
    ...overrides,
  })
}

function arriveWith(search: string) {
  mockOpenAuthSession.mockResolvedValue({
    type: 'success',
    url: `${DATA_EXCHANGE_RETURN_URL}?${search}`,
  })
}

function cachedGrant(): unknown {
  const raw = mockMmkv.get(MMKV_AUTH_KEYS.grantedPermissions)
  return raw === undefined ? undefined : JSON.parse(raw)
}

describe('requestDataExchange — happy path', () => {
  it('mints, opens the hosted consent page against the SDK-owned return scheme, and reports the grant', async () => {
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run()

    expect(outcome).toEqual({ status: 'granted', grantedPermissions: ['highlights'] })
    expect(mintToken).toHaveBeenCalledWith('tok', ['highlights'])

    const [url, returnUrl] = mockOpenAuthSession.mock.calls[0] as [string, string]
    // The return scheme is hardcoded and SDK-owned — never the app's redirectUri.
    expect(returnUrl).toBe('youversionauth://callback')
    const parsed = new URL(url)
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
    // This is also what Android reports when the app never registered the
    // `youversionauth` scheme: the session hangs, then reports `dismiss`.
    saveGrantedPermissions('u1', ['votd'])
    mockOpenAuthSession.mockResolvedValue({ type: 'dismiss' })

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

    const outcome = await run({ getCurrentIdentity: () => ({ epoch: 2, userId: 'u2' }) })

    expect(outcome).toMatchObject({ status: 'failure', reason: 'user-changed' })
    // Neither user's cache was written: u1's entry is untouched, and nothing
    // was recorded for u2.
    expect(cachedGrant()).toEqual({ userId: 'u1', permissions: ['votd'] })
  })

  it('fails when the user signed out mid-flow', async () => {
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run({ getCurrentIdentity: () => ({ epoch: 2, userId: null }) })

    expect(outcome).toMatchObject({ status: 'failure', reason: 'user-changed' })
    expect(cachedGrant()).toBeUndefined()
  })

  it('accepts a grant for a signed-in user with no id, rather than failing closed forever', async () => {
    // `userInfo.id` comes from the id_token's `sub` and can legitimately be
    // absent; treating that as a mismatch would make the flow unusable.
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run({
      initiator: { epoch: 1, userId: null },
      getCurrentIdentity: () => ({ epoch: 1, userId: null }),
    })

    expect(outcome).toEqual({ status: 'granted', grantedPermissions: ['highlights'] })
    expect(cachedGrant()).toEqual({ userId: null, permissions: ['highlights'] })
  })

  it('discards an id-less user’s grant when the session changed mid-flow', async () => {
    // The hole the epoch exists to close: comparing ids alone, `null === null`
    // waves this through, the grant is written after the user has gone, and the
    // next id-less user reads it back as their own consent.
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run({
      initiator: { epoch: 1, userId: null },
      getCurrentIdentity: () => ({ epoch: 3, userId: null }),
    })

    expect(outcome).toMatchObject({ status: 'failure', reason: 'user-changed' })
    expect(cachedGrant()).toBeUndefined()
  })

  it('accepts a grant when only the token changed mid-flow', async () => {
    // A refresh issues a new token for the same person and leaves the epoch
    // alone, so it must not fail the guard.
    arriveWith('data_exchange_status=granted&granted_permissions[]=highlights')

    const outcome = await run({
      initiator: { epoch: 4, userId: 'u1' },
      getCurrentIdentity: () => ({ epoch: 4, userId: 'u1' }),
    })

    expect(outcome).toEqual({ status: 'granted', grantedPermissions: ['highlights'] })
    expect(cachedGrant()).toEqual({ userId: 'u1', permissions: ['highlights'] })
  })
})
