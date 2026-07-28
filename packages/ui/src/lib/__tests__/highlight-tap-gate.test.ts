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

  // Both branches become prompts when the sign-in sheet and the just-in-time
  // alert land. Until then they are silent, which is what the swatches do today.
  it('no-ops when signed out', () => {
    expect(gate({ isSignedIn: false, hasHighlightsPermission: false })).toBe('noop')
  })

  it('no-ops when signed in without the highlights permission', () => {
    expect(gate({ hasHighlightsPermission: false })).toBe('noop')
  })

  it('covers the full input matrix without ever returning a prompt yet', () => {
    const bools = [false, true]
    const outcomes = new Set<string>()

    for (const isAuthConfigured of bools) {
      for (const isSignedIn of bools) {
        for (const hasHighlightsPermission of bools) {
          outcomes.add(gate({ isAuthConfigured, isSignedIn, hasHighlightsPermission }))
        }
      }
    }

    expect(outcomes).toEqual(new Set(['write', 'noop']))
  })
})
