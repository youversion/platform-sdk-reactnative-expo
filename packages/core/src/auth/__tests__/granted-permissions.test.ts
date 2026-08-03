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
