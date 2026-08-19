/**
 * Mounts the Highlight Write Queue drain and wires it to the moments a parked
 * write is worth retrying. Renders nothing.
 *
 * Rendered inside `AuthProvider`, so an app with no auth configured has no drain
 * at all rather than an inert one.
 */

import { addNetworkStateListener } from 'expo-network'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { AppState } from 'react-native'

import { useYVAuthOptional } from '../auth'
import { useYouVersion } from '../use-youversion'
import { createHighlightsApi } from './api'
import { onDrainSignal } from './drain-signals'
import { startHighlightQueueDrain, type DrainAuth, type HighlightQueueDrain } from './drain'

export function HighlightQueueDrainHost(): ReactNode {
  const { appKey, apiHost, installationId } = useYouVersion()
  const auth = useYVAuthOptional()

  const userId = auth?.userInfo?.id ?? null
  const accessToken = auth?.accessToken ?? null
  const getAccessToken = auth?.getAccessToken ?? null

  // The drain wants the refresh side effect only — it re-reads the token per
  // scope from this same context afterwards. The forced retry uses the same
  // accessor with `{ force: true }` so a silent mint failure cannot look like
  // a freshly minted token.
  const ensureFreshToken = useMemo(
    () =>
      getAccessToken === null
        ? null
        : async () => {
            await getAccessToken()
          },
    [getAccessToken],
  )

  const authRef = useRef<DrainAuth>({ userId, accessToken, ensureFreshToken, getAccessToken })
  // Declared before the effects that read it: effects run in order, so the drain
  // starts against real values rather than the mount-time snapshot.
  useEffect(() => {
    authRef.current = { userId, accessToken, ensureFreshToken, getAccessToken }
  })

  const api = useMemo(
    () => createHighlightsApi({ appKey, apiHost, installationId }),
    [appKey, apiHost, installationId],
  )

  const drainRef = useRef<HighlightQueueDrain | null>(null)

  useEffect(() => {
    const drain = startHighlightQueueDrain({ api, getAuth: () => authRef.current })
    drainRef.current = drain
    return () => {
      drain.stop()
      drainRef.current = null
    }
  }, [api])

  // Mount, sign-in, and token refresh.
  useEffect(() => {
    drainRef.current?.drainNow()
  }, [userId, accessToken])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        drainRef.current?.drainNow()
      }
    })
    return () => subscription.remove()
  }, [])

  useEffect(
    () =>
      onDrainSignal((signal) => {
        if (signal === 'service-reached') {
          drainRef.current?.drainNow()
        } else {
          drainRef.current?.noteParkedWrite()
        }
      }),
    [],
  )

  useEffect(() => {
    // Rising edge only, seeded connected: a redundant event on subscribe must not
    // duplicate the mount drain. `undefined` is unknown and changes nothing.
    let wasConnected = true
    const subscription = addNetworkStateListener(({ isConnected }) => {
      if (isConnected === undefined) {
        return
      }
      if (isConnected && !wasConnected) {
        drainRef.current?.drainNow()
      }
      wasConnected = isConnected
    })
    return () => subscription.remove()
  }, [])

  return null
}

export default HighlightQueueDrainHost
