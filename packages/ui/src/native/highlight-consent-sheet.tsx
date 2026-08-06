import { StyleSheet, Text, View } from 'react-native'

import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { SHEET_FOREGROUND } from '../lib/native-sheet-theme'
import type { Theme } from '../lib/resolve-theme'
import { NativeSheet } from './native-sheet'
import { PromptSheetButton, PromptSheetParagraph } from './prompt-sheet'

export type HighlightConsentSheetProps = {
  isOpen: boolean
  /** "Continue" — hand off to the just-in-time Data Exchange grant. */
  onConfirm: () => void
  /**
   * "Cancel", a swipe-down, a backdrop tap, or displacement by another sheet —
   * every one of them a decline. Route all of them here; a dismissal path that
   * skips `decline()` strands the flow with `isConfirming` still true.
   */
  onDismiss: () => void
  theme: Theme
}

/**
 * Just-in-time permission prompt, shown when a signed-in user without the
 * `highlights` permission taps a highlight color.
 *
 * Presentational only — it runs no Data Exchange itself. `isOpen` is driven by
 * `useHighlightPermissionFlow`'s `isConfirming`; `onConfirm` is its `confirm()`
 * and `onDismiss` its `decline()`. Its buttons and paragraph come from
 * `prompt-sheet.tsx`, shared with `SignInWithYouVersionSheet` so the two prompts
 * in the highlight flow read as one family.
 */
export function HighlightConsentSheet({
  isOpen,
  onConfirm,
  onDismiss,
  theme,
}: HighlightConsentSheetProps) {
  const { t } = useSdkTranslation()

  return (
    <NativeSheet isOpen={isOpen} onClose={onDismiss} theme={theme}>
      <View testID="highlight-consent-sheet" style={styles.container}>
        <Text
          accessibilityRole="header"
          style={[styles.heading, { color: SHEET_FOREGROUND[theme] }]}
        >
          {t('dataExchangeHighlightsQuestion')}
        </Text>

        <PromptSheetParagraph theme={theme}>
          {t('dataExchangeHighlightsExplanation')}
        </PromptSheetParagraph>

        <View style={styles.actions}>
          <PromptSheetButton
            testID="highlight-consent-confirm"
            label={t('dataExchangeContinue')}
            onPress={onConfirm}
            variant="primary"
            theme={theme}
          />

          <PromptSheetButton
            testID="highlight-consent-cancel"
            label={t('cancel')}
            onPress={onDismiss}
            variant="secondary"
            theme={theme}
          />
        </View>
      </View>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
  },
})
