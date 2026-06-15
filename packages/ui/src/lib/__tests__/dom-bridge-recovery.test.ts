// The recovery module mirrors expo's wire-protocol constants by value (it
// rebuilds the bridge on the raw transport — see dom-bridge-recovery.tsx).
// If a future Expo renames any of them, recovery would silently stop working
// and DOM components would blank again in Android release builds. The drift
// tests below fail loudly on that instead.
//
// Four message-type constants are exported from expo/src/dom/injection.ts.
// The props-update message type is an inline literal in
// expo/src/dom/webview-wrapper.tsx (the emit) and expo/src/dom/dom-entry.tsx
// (the listener), never exported, so we read the source text and assert our
// constant appears in it.
import {
  createRecoveryStore,
  shouldActivateRecovery,
  withDomBridgeRecovery,
  DOM_EVENT,
  NATIVE_ACTION,
  NATIVE_ACTION_RESULT,
  MATCH_CONTENTS_EVENT,
  PROPS_EVENT,
} from '../dom-bridge-recovery'

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

describe('expo wire-constant drift detection', () => {
  // Resolve to the real on-disk expo source. We read source text (not import
  // it) because some constants are inline literals that are never exported.
  const expoDomDir = dirname(require.resolve('expo/src/dom/injection.ts'))
  const injectionSrc = readFileSync(join(expoDomDir, 'injection.ts'), 'utf8')
  const webviewWrapperSrc = readFileSync(join(expoDomDir, 'webview-wrapper.tsx'), 'utf8')
  const domEntrySrc = readFileSync(join(expoDomDir, 'dom-entry.tsx'), 'utf8')

  // Pulls `export const NAME = 'value'` out of expo's source so we compare
  // against the canonical string rather than restating it here.
  const extract = (name: string, src: string): string => {
    const match = src.match(new RegExp(`export const ${name} = ('[^']+')`))
    if (!match) throw new Error(`expo constant ${name} not found in source`)
    // eslint-disable-next-line @typescript-eslint/no-eval
    return eval(match[1])
  }

  it('DOM_EVENT matches expo injection.ts', () => {
    expect(DOM_EVENT).toBe(extract('DOM_EVENT', injectionSrc))
  })

  it('NATIVE_ACTION matches expo injection.ts', () => {
    expect(NATIVE_ACTION).toBe(extract('NATIVE_ACTION', injectionSrc))
  })

  it('NATIVE_ACTION_RESULT matches expo injection.ts', () => {
    expect(NATIVE_ACTION_RESULT).toBe(extract('NATIVE_ACTION_RESULT', injectionSrc))
  })

  it('MATCH_CONTENTS_EVENT matches expo injection.ts', () => {
    expect(MATCH_CONTENTS_EVENT).toBe(extract('MATCH_CONTENTS_EVENT', injectionSrc))
  })

  it('PROPS_EVENT matches the literal expo emits and reads for prop updates', () => {
    // webview-wrapper.tsx emits `{ type: '<PROPS_EVENT>', ... }` on every
    // native render; dom-entry.tsx listens for the same literal. If expo
    // renames it, recovery's listener stops receiving updates. Build the
    // quoted token from the constant so this test is self-consistent.
    const quoted = `'${PROPS_EVENT}'`
    expect(webviewWrapperSrc).toContain(quoted)
    expect(domEntrySrc).toContain(quoted)
  })
})

describe('shouldActivateRecovery', () => {
  it('activates inside a WebView missing the expo globals (race lost)', () => {
    expect(shouldActivateRecovery({ ReactNativeWebView: {} })).toBe(true)
  })

  it('stays inert outside a WebView', () => {
    expect(shouldActivateRecovery({})).toBe(false)
    expect(shouldActivateRecovery({ $$EXPO_DOM_HOST_OS: undefined })).toBe(false)
  })

  it('stays inert when the expo globals were injected in time (race won)', () => {
    expect(
      shouldActivateRecovery({ ReactNativeWebView: {}, $$EXPO_DOM_HOST_OS: 'android' }),
    ).toBe(false)
  })
})

describe('createRecoveryStore', () => {
  it('starts with empty marshalled props', () => {
    const store = createRecoveryStore()
    expect(store.get()).toEqual({ names: [], props: {} })
  })

  it('notifies subscribers and updates the current value on set', () => {
    const store = createRecoveryStore()
    const seen: unknown[] = []
    store.subscribe((next) => seen.push(next))

    const injected = { names: ['onPress'], props: { appKey: 'k' } }
    store.set(injected)

    expect(store.get()).toBe(injected)
    expect(seen).toEqual([injected])
  })

  it('stops notifying after unsubscribe', () => {
    const store = createRecoveryStore()
    const seen: unknown[] = []
    const unsubscribe = store.subscribe((next) => seen.push(next))

    unsubscribe()
    store.set({ names: [], props: { a: 1 } })

    expect(seen).toEqual([])
  })
})

describe('withDomBridgeRecovery', () => {
  it('returns the component unwrapped when the race was won (no recovery store)', () => {
    // In this test environment there is no ReactNativeWebView global, so the
    // module-level bootstrap stays inert and the HOC must be a passthrough.
    const Component = () => null
    expect(withDomBridgeRecovery(Component)).toBe(Component)
  })
})
