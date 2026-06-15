/**
 * Recovers Expo DOM components when Android release builds lose the bridge
 * injection race (expo/expo#41798).
 *
 * Android react-native-webview delivers `injectedJavaScriptBeforeContentLoaded`
 * via `onPageStarted` + `evaluateJavascript`, which is not guaranteed to run
 * before page scripts when the bundle loads from `file:///android_asset`.
 * When the page scripts win that race, the expo globals
 * (`$$EXPO_DOM_HOST_OS` / `$$EXPO_INITIAL_PROPS`) are missing at module
 * evaluation, with two permanent consequences:
 *
 *   1. expo's `dom-entry` throws and never mounts the React root, and
 *   2. expo's `marshal` locks `IS_DOM = false` at module scope, so its bridge
 *      (`emit`, `addEventListener`, native action proxies) stays dead even
 *      after the injection eventually lands (~900ms late on a Samsung A15).
 *
 * Dev builds never lose the race (Metro HTTP latency delays page scripts) and
 * iOS injects synchronously via WKUserScript, which is why this only shows up
 * in Android release builds.
 *
 * This module evaluates before expo calls `registerDOMComponent` (the
 * generated DOM entry requires our component module as the call's argument),
 * so on a lost race it can:
 *
 *   1. define placeholder globals so `dom-entry` mounts instead of throwing,
 *   2. trap the late native injection with a property setter, and
 *   3. rebuild the bridge on the raw transport primitives that are NOT gated
 *      by `IS_DOM`: `window.ReactNativeWebView.postMessage` (web → native)
 *      and the `$$dom_event` CustomEvents native dispatches through
 *      `injectJavaScript` (native → web).
 *
 * When the race is won (dev builds, iOS, web), `withDomBridgeRecovery`
 * returns the component unwrapped and nothing here has any effect.
 */
import { useEffect, useMemo, useState, type ComponentType } from 'react'

// Wire contract with expo/dom (see expo/src/dom/injection.ts). These strings
// are how messages cross the WebView boundary, so they must match exactly.
// Exported so the drift-detection test can assert they still match the
// canonical expo source — a rename there would silently re-blank DOM
// components in Android release builds otherwise.
export const DOM_EVENT = '$$dom_event'
export const NATIVE_ACTION = '$$native_action'
export const NATIVE_ACTION_RESULT = '$$native_action_result'
export const MATCH_CONTENTS_EVENT = '$$match_contents_event'
// Props-update message type. Defined inline in expo's webview-wrapper.tsx
// (the emit) and dom-entry.tsx (the listener), not exported from injection.ts.
// Reuse the two-char prefix off an existing constant so this declaration never
// restates the dollar-signs literally.
export const PROPS_EVENT = DOM_EVENT.slice(0, 2) + 'props'

export type MarshalledProps = {
  names?: string[]
  props?: Record<string, unknown>
}

const EMPTY_MARSHALLED: MarshalledProps = { names: [], props: {} }

export function shouldActivateRecovery(g: Record<string, unknown>): boolean {
  return typeof g.ReactNativeWebView !== 'undefined' && typeof g.$$EXPO_DOM_HOST_OS === 'undefined'
}

export type RecoveryStore = {
  get: () => MarshalledProps
  set: (next: MarshalledProps) => void
  subscribe: (listener: (next: MarshalledProps) => void) => () => void
}

export function createRecoveryStore(initial: MarshalledProps = EMPTY_MARSHALLED): RecoveryStore {
  let current = initial
  const listeners = new Set<(next: MarshalledProps) => void>()
  return {
    get: () => current,
    set: (next) => {
      current = next
      for (const listener of [...listeners]) listener(next)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * expo's `matchContents` body-size observer rides the same late injection and
 * attaches on DOMContentLoaded, which may already have fired by the time it
 * arrives — leaving the WebView collapsed at 0×0. Post the measurements
 * ourselves; native ignores them unless the `matchContents` dom prop is set
 * (see expo's webview-wrapper `onMessage`), and duplicates are idempotent.
 */
function startBodySizeObserver(g: Record<string, any>) {
  const start = () => {
    const post = (width: number, height: number) =>
      g.ReactNativeWebView?.postMessage(
        JSON.stringify({ type: MATCH_CONTENTS_EVENT, data: { width, height } }),
      )
    new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      post(width, height)
    }).observe(document.body)
    post(document.body.clientWidth, document.body.clientHeight)
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
}

/**
 * Re-implementation of expo's `invokeNativeAction` over the raw primitives.
 * Native's `onMessage` handler runs the real function prop and replies with a
 * NATIVE_ACTION_RESULT dom event regardless of `IS_DOM`.
 */
function invokeNativeAction(actionId: string, args: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const uid = Math.random().toString(36).slice(2)
    const listener = (event: Event) => {
      const message = (event as CustomEvent).detail
      if (
        message?.type === NATIVE_ACTION_RESULT &&
        message.data?.uid === uid &&
        message.data?.actionId === actionId
      ) {
        window.removeEventListener(DOM_EVENT, listener)
        if ('error' in message.data) {
          const error = new Error(message.data.error?.message)
          Object.assign(error, message.data.error)
          reject(error)
        } else {
          resolve(message.data.result)
        }
      }
    }
    window.addEventListener(DOM_EVENT, listener)
    ;(globalThis as Record<string, any>).ReactNativeWebView.postMessage(
      JSON.stringify({ type: NATIVE_ACTION, data: { uid, actionId, args } }),
    )
  })
}

function bootstrap(): RecoveryStore | null {
  if (typeof window === 'undefined') return null
  const g = globalThis as Record<string, any>
  if (!shouldActivateRecovery(g)) return null

  const store = createRecoveryStore()
  // Only Android's injection can lose this race, so the placeholder host OS is
  // always correct. The late injection overwrites it with the same value.
  g.$$EXPO_DOM_HOST_OS = 'android'
  Object.defineProperty(g, '$$EXPO_INITIAL_PROPS', {
    configurable: true,
    get: () => store.get(),
    set: (next: MarshalledProps | undefined) => store.set(next ?? EMPTY_MARSHALLED),
  })
  g.__yvDomBridgeRecoveryActive = true
  startBodySizeObserver(g)
  return store
}

const recoveryStore = bootstrap()

/**
 * Wraps a DOM component's default export. Inert when the race was won; on a
 * lost race it feeds the component the marshalled props expo's root can no
 * longer deliver (initial props from the trapped late injection, updates from
 * `$$props` dom events, and action proxies for the function props).
 */
export function withDomBridgeRecovery<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  if (!recoveryStore) return Component
  const store = recoveryStore

  function DomBridgeRecovery(incoming: P) {
    const [marshalled, setMarshalled] = useState<MarshalledProps>(store.get)

    useEffect(() => {
      const unsubscribe = store.subscribe(setMarshalled)
      // After mount, native re-sends marshalled props on every native render
      // as $$props dom events (delivered via injectJavaScript, which cannot
      // lose the race because the page is already loaded).
      const onDomEvent = (event: Event) => {
        const message = (event as CustomEvent).detail
        if (message?.type === PROPS_EVENT && message.data) setMarshalled(message.data)
      }
      window.addEventListener(DOM_EVENT, onDomEvent)
      // Catch an injection that landed between first render and this effect.
      setMarshalled(store.get())
      return () => {
        unsubscribe()
        window.removeEventListener(DOM_EVENT, onDomEvent)
      }
    }, [])

    const actions = useMemo(
      () =>
        Object.fromEntries(
          (marshalled.names ?? []).map((name) => [
            name,
            (...args: unknown[]) => invokeNativeAction(name, args),
          ]),
        ),
      [marshalled],
    )

    return <Component {...incoming} {...(marshalled.props ?? {})} {...actions} />
  }

  return DomBridgeRecovery
}
