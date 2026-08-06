import type { HighlightScope } from '@youversion/platform-react-native-expo-core'
import type { BibleReaderHighlightIntent } from '@youversion/platform-react-ui'

import {
  gateHighlightTap,
  isIntentInScope,
  type HighlightTapGateInput,
} from '../highlight-tap-gate'

const SCOPE: HighlightScope = { versionId: 111, book: 'JHN', chapter: '3' }

const INTENT: BibleReaderHighlightIntent = {
  versionId: 111,
  book: 'JHN',
  chapter: '3',
  verses: [16],
  passageIds: ['JHN.3.16'],
  color: 'fffe00',
}

function gate(overrides: Partial<HighlightTapGateInput> = {}) {
  return gateHighlightTap({
    intent: INTENT,
    scope: SCOPE,
    isAuthConfigured: true,
    isSignedIn: true,
    hasHighlightsPermission: true,
    ...overrides,
  })
}

describe('isIntentInScope', () => {
  it('matches on all three axes', () => {
    expect(isIntentInScope(INTENT, SCOPE)).toBe(true)
  })

  it('rejects a version mismatch', () => {
    expect(isIntentInScope({ ...INTENT, versionId: 1 }, SCOPE)).toBe(false)
  })

  it('rejects a book mismatch', () => {
    expect(isIntentInScope({ ...INTENT, book: 'GEN' }, SCOPE)).toBe(false)
  })

  it('rejects a chapter mismatch', () => {
    expect(isIntentInScope({ ...INTENT, chapter: '4' }, SCOPE)).toBe(false)
  })
})

describe('gateHighlightTap', () => {
  it('writes when signed in with the permission and the scope matches', () => {
    expect(gate()).toBe('write')
  })

  describe('scope mismatch', () => {
    // A tap crosses the bridge asynchronously, so it can land after the reader
    // has already moved on. Writing it would paint the old selection into the
    // new chapter.
    it('drops an intent for another version', () => {
      expect(gate({ intent: { ...INTENT, versionId: 206 } })).toBe('noop')
    })

    it('drops an intent for another book', () => {
      expect(gate({ intent: { ...INTENT, book: 'GEN' } })).toBe('noop')
    })

    it('drops an intent for another chapter', () => {
      expect(gate({ intent: { ...INTENT, chapter: '4' } })).toBe('noop')
    })

    it('drops a stale intent before any auth branch is considered', () => {
      // Signed out AND out of scope: the scope check wins, so nothing prompts.
      expect(
        gate({
          intent: { ...INTENT, chapter: '4' },
          isSignedIn: false,
          hasHighlightsPermission: false,
        }),
      ).toBe('noop')
    })
  })

  it('no-ops when auth is not configured, even for an in-scope tap', () => {
    expect(
      gate({ isAuthConfigured: false, isSignedIn: false, hasHighlightsPermission: false }),
    ).toBe('noop')
  })

  it('no-ops when auth is not configured regardless of any stale signed-in state', () => {
    expect(gate({ isAuthConfigured: false })).toBe('noop')
  })

  it('prompts to sign in when signed out with auth configured', () => {
    expect(gate({ isSignedIn: false, hasHighlightsPermission: false })).toBe('prompt-sign-in')
  })

  it('prompts for the permission when signed in without the grant', () => {
    expect(gate({ hasHighlightsPermission: false })).toBe('prompt-permission')
  })

  it('covers the full input matrix', () => {
    const bools = [false, true]
    const outcomes = new Map<string, string>()

    for (const isAuthConfigured of bools) {
      for (const isSignedIn of bools) {
        for (const hasHighlightsPermission of bools) {
          outcomes.set(
            `${isAuthConfigured}|${isSignedIn}|${hasHighlightsPermission}`,
            gate({ isAuthConfigured, isSignedIn, hasHighlightsPermission }),
          )
        }
      }
    }

    expect(Object.fromEntries(outcomes)).toEqual({
      // auth not configured — never anything, whatever the rest says.
      'false|false|false': 'noop',
      'false|false|true': 'noop',
      'false|true|false': 'noop',
      'false|true|true': 'noop',
      'true|false|false': 'prompt-sign-in',
      // Signed out but believed-granted (a stale mirror) still has to sign in.
      'true|false|true': 'prompt-sign-in',
      'true|true|false': 'prompt-permission',
      'true|true|true': 'write',
    })
  })
})
