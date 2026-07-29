import { useCallback } from 'react'
import { Alert } from 'react-native'

import { useSdkTranslation } from '../i18n/use-sdk-translation'

/**
 * The slice of auth context the guard needs. Deliberately structural rather than
 * `AuthContextValue`: the reader reaches auth through `useYVAuthOptional()` and
 * may have none at all, while the button uses `useYVAuth()`.
 */
export type SignOutGuardAuth = {
  signOut: () => Promise<void>
  hasPendingHighlightOperations?: boolean
  discardPendingHighlights?: () => void
} | null

/**
 * Wraps `signOut()` in the unsaved-highlights warning.
 *
 * Core exposes the fact (`hasPendingHighlightOperations`); the prompt and its
 * strings live here, because `packages/core` has no UI and no i18n. Every
 * sign-out surface the SDK owns routes through this so the warning cannot be
 * true on one button and missing on another.
 *
 * Confirming **discards** the queue rather than flushing it, matching Swift: the
 * explanation already told the user the work would be lost, and flushing on the
 * dead network that caused the backlog would hang the sign-out they just asked
 * for. Cancelling leaves the queue untouched and the user signed in.
 *
 * Returns `undefined` when there is nothing to sign out of, so callers can pass
 * the result straight through to an optional handler prop.
 */
export function useSignOutGuard(auth: SignOutGuardAuth): (() => Promise<void>) | undefined {
  const { t } = useSdkTranslation()
  const signOut = auth?.signOut
  const hasPending = auth?.hasPendingHighlightOperations ?? false
  const discardPendingHighlights = auth?.discardPendingHighlights

  const guardedSignOut = useCallback(async () => {
    if (signOut === undefined) {
      return
    }
    if (!hasPending) {
      await signOut()
      return
    }

    // An alert, not a sheet — Swift makes the sign-in prompt the only full sheet
    // in this flow, and both sign-out dialogs are native alerts.
    Alert.alert(
      t('signOut.pendinghighlights.question'),
      t('signOut.pendinghighlights.explanation'),
      [
        { text: t('generic.cancel'), style: 'cancel' },
        {
          text: t('signOut.pendinghighlights.confirm'),
          style: 'destructive',
          onPress: () => {
            // `signOut` clears the queue too, but discarding first is what makes
            // the generation bump observable before any await — a write that
            // settles in between can no longer re-queue.
            discardPendingHighlights?.()
            void signOut()
          },
        },
      ],
      // Android's hardware back / outside tap dismisses without a button press,
      // and dismissing is a cancel: the user stays signed in, queue intact.
      { onDismiss: () => {} },
    )
  }, [signOut, hasPending, discardPendingHighlights, t])

  return signOut === undefined ? undefined : guardedSignOut
}
