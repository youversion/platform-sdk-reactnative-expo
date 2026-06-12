import {
  createRecoveryStore,
  shouldActivateRecovery,
  withDomBridgeRecovery,
} from '../dom-bridge-recovery'

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
