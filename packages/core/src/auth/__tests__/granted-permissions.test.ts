import { parseGrantedPermissions } from '@youversion/platform-core'

import { readGrantedPermissions } from '../granted-permissions'

describe('readGrantedPermissions — presence detection', () => {
  it('returns null when the redirect carries no granted_permissions key at all', () => {
    const params = new URLSearchParams('state=STATE&code=AUTHCODE')
    expect(readGrantedPermissions(params)).toBeNull()
  })

  it('returns null for a lookalike key that is not a granted_permissions spelling', () => {
    const params = new URLSearchParams(
      'requested_permissions[]=highlights&granted_perms=highlights',
    )
    expect(readGrantedPermissions(params)).toBeNull()
  })

  it('reads the bare granted_permissions spelling', () => {
    const params = new URLSearchParams('state=STATE&granted_permissions=highlights')
    expect(readGrantedPermissions(params)).toEqual(['highlights'])
  })

  it('reads the repeated granted_permissions[] spelling', () => {
    const params = new URLSearchParams(
      'granted_permissions[]=highlights&granted_permissions[]=bibles',
    )
    expect(readGrantedPermissions(params)).toEqual(['highlights', 'bibles'])
  })

  it('reads the indexed granted_permissions[n] spelling', () => {
    const params = new URLSearchParams(
      'granted_permissions[0]=highlights&granted_permissions[1]=votd',
    )
    expect(readGrantedPermissions(params)).toEqual(['highlights', 'votd'])
  })
})

describe('readGrantedPermissions — three-state semantics', () => {
  it('distinguishes an empty value ("requested and denied") from an absent key ("unknown")', () => {
    expect(readGrantedPermissions(new URLSearchParams('granted_permissions[]='))).toEqual([])
    expect(readGrantedPermissions(new URLSearchParams('granted_permissions='))).toEqual([])
    expect(readGrantedPermissions(new URLSearchParams(''))).toBeNull()
  })

  it('keeps a permission value outside the AuthPermission union instead of filtering it', () => {
    // Filtering would turn a server-side addition into a silent denial.
    const params = new URLSearchParams(
      'granted_permissions[]=highlights&granted_permissions[]=brand_new_permission',
    )
    expect(readGrantedPermissions(params)).toEqual(['highlights', 'brand_new_permission'])
  })
})

/**
 * Why this test exists.
 *
 * `readGrantedPermissions` detects key presence with its own
 * `GRANTED_PERMISSIONS_KEY_PATTERN`, which duplicates a regex living inside
 * platform-core's `parseGrantedPermissions`. platform-core exports neither the
 * pattern nor a presence-detecting helper, so the duplication cannot be
 * deleted. If platform-core later accepts a key spelling our copy does not,
 * a real grant reads as `null` ("unknown") instead of "granted", and the app
 * re-prompts for permission the user already gave.
 *
 * These cases compare the two sides through the public API — never the regex
 * literal against itself — so the suite fails on upstream drift in either
 * direction.
 */
describe('readGrantedPermissions — key-spelling parity with platform-core', () => {
  // The probe value is non-empty, so `parseGrantedPermissions` returns a
  // non-empty array exactly when upstream recognises the key spelling.
  const PROBE_VALUE = 'x'

  const ON_MISMATCH =
    'platform-core changed which granted_permissions key spellings it accepts. ' +
    'Update GRANTED_PERMISSIONS_KEY_PATTERN in ' +
    'packages/core/src/auth/granted-permissions.ts to match, and add the new ' +
    'spelling to KEY_SPELLINGS below.'

  const KEY_SPELLINGS = [
    // Expected to be recognised by both sides today.
    'granted_permissions',
    'granted_permissions[]',
    'granted_permissions[0]',
    'granted_permissions[12]',
    'granted_permissions[00]',
    // Expected to be recognised by neither side today.
    'granted_permissionsx',
    'granted_permissions[a]',
    'granted_permissions[-1]',
    'granted_permissions[0][0]',
    'granted_permissions[]extra',
    'xgranted_permissions',
    'granted_permission',
    'GRANTED_PERMISSIONS',
    ' granted_permissions',
    'granted_permissions ',
  ]

  it.each(KEY_SPELLINGS)(
    'our presence detection agrees with platform-core on "%s"',
    (key: string) => {
      const buildParams = () => new URLSearchParams([[key, PROBE_VALUE]])

      const upstreamRecognises = parseGrantedPermissions(buildParams()).length > 0
      const weRecognise = readGrantedPermissions(buildParams()) !== null

      expect({ key, weRecognise, onMismatch: ON_MISMATCH }).toEqual({
        key,
        weRecognise: upstreamRecognises,
        onMismatch: ON_MISMATCH,
      })
    },
  )
})
