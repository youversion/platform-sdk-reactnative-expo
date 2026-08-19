import { StyleSheet, Text, View } from 'react-native'

import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { resolveAppName } from '../lib/app-name'
import { SHEET_MUTED_FOREGROUND } from '../lib/native-sheet-theme'
import type { Theme } from '../lib/resolve-theme'
import { NativeSheet } from './native-sheet'
import { PromptSheetButton, PromptSheetParagraph } from './prompt-sheet'
import { YouVersionPlatformLogo, youVersionPlatformLogoSize } from './youversion-platform-logo'

/** Wide enough to read at the sheet's width, narrow enough to leave margin. */
const WORDMARK_WIDTH = 190
const WORDMARK_SIZE = youVersionPlatformLogoSize(WORDMARK_WIDTH)

export type SignInWithYouVersionSheetProps = {
  isOpen: boolean
  /** "Yes Please". Launches the OAuth sign-in flow. */
  onConfirm: () => void
  /** "No Thanks", a swipe-down, or a backdrop tap. Every one is a cancel. */
  onDismiss: () => void
  theme: Theme
}

/**
 * "Sign in with YouVersion" introduction sheet, shown when a signed-out user
 * taps a highlight color, before OAuth launches.
 *
 * Presentational only. It runs no OAuth and reads no config beyond the app's own
 * display name. Its buttons and paragraph come from `prompt-sheet.tsx`, shared
 * with `HighlightConsentSheet` so the two prompts in the highlight flow read as
 * one family.
 */
export function SignInWithYouVersionSheet({
  isOpen,
  onConfirm,
  onDismiss,
  theme,
}: SignInWithYouVersionSheetProps) {
  const { t } = useSdkTranslation()
  const appName = resolveAppName()

  return (
    <NativeSheet isOpen={isOpen} onClose={onDismiss} theme={theme}>
      <View testID="sign-in-with-youversion-sheet" style={styles.container}>
        <Text style={[styles.eyebrow, { color: SHEET_MUTED_FOREGROUND[theme] }]}>
          {t('signInIntroducing')}
        </Text>

        <YouVersionPlatformLogo
          theme={theme}
          accessibilityLabel={t('youVersionPlatformLogoAriaLabel')}
          width={WORDMARK_SIZE.width}
          height={WORDMARK_SIZE.height}
        />

        <PromptSheetParagraph theme={theme}>
          {t('signInParagraph', { appName: appName ?? '' })}
        </PromptSheetParagraph>

        <View style={styles.actions}>
          <PromptSheetButton
            testID="sign-in-with-youversion-confirm"
            label={t('signInYesButton')}
            onPress={onConfirm}
            variant="primary"
            theme={theme}
          />

          <PromptSheetButton
            testID="sign-in-with-youversion-decline"
            label={t('signInNoButton')}
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
    gap: 16,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  actions: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
})
