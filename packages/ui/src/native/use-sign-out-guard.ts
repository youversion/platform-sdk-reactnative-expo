import { hasQueuedHighlightWrites } from '@youversion/platform-react-native-expo-core'
import { useCallback } from 'react'
import { Alert, Platform } from 'react-native'

import { useSdkTranslation } from '../i18n/use-sdk-translation'

/**
 * The slice of auth context the guard needs. Deliberately structural rather than
 * `AuthContextValue`: the reader reaches auth through `useYVAuthOptional()` and
 * may have none at all, while the button uses `useYVAuth()`.
 */
type SignOutGuardAuth = {
  signOut: () => Promise<void>
  isAuthenticated?: boolean
  userInfo?: { id?: string | null } | null
} | null

/**
 * Wraps `signOut()` in the native confirmation the reader toolbar already raised
 * before extraction. Every SDK-owned sign-out surface routes through this so the
 * warning cannot be true on one button and missing on another.
 *
 * When the Highlight Write Queue still holds unsent work, the copy escalates; on
 * confirm the guard calls `signOut()` only — core's `clearAuthState` clears the
 * queue and cache. Cancelling leaves the user signed in and the queue intact.
 *
 * On web, `Alert.alert` is a no-op, so the guard calls `signOut()` directly.
 *
 * When auth is configured but `isAuthenticated` is false (or has not caught up with
 * a stored session), the guard still runs `signOut()` to clear leftover credentials
 * — no Alert is shown. The Alert runs only when the user is authenticated.
 *
 * Returns `undefined` when auth is not configured (`signOut` is missing), so callers
 * can pass the result straight through to an optional handler prop.
 */
export function useSignOutGuard(auth: SignOutGuardAuth): (() => Promise<void>) | undefined {
  const { t } = useSdkTranslation()
  const signOut = auth?.signOut
  const isAuthenticated = auth?.isAuthenticated ?? false
  const userId = auth?.userInfo?.id ?? null

  const guardedSignOut = useCallback(async () => {
    if (signOut === undefined) {
      return
    }

    if (!isAuthenticated) {
      await signOut().catch((err) => console.error(err))
      return
    }

    if (Platform.OS === 'web') {
      await signOut().catch((err) => console.error(err))
      return
    }

    const hasUnsentHighlights = hasQueuedHighlightWrites(userId)

    Alert.alert(
      hasUnsentHighlights ? t('signOutPendingHighlightsQuestion') : t('signOutQuestion'),
      hasUnsentHighlights ? t('signOutPendingHighlightsExplanation') : t('signOutExplanation'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: hasUnsentHighlights ? t('signOutPendingHighlightsConfirm') : t('signOut'),
          style: 'destructive',
          onPress: () => {
            void signOut().catch((err) => console.error(err))
          },
        },
      ],
    )
  }, [signOut, isAuthenticated, userId, t])

  if (signOut === undefined) {
    return undefined
  }

  return guardedSignOut
}
