import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { resolveAppName } from '../lib/app-name'
import type { Theme } from '../lib/resolve-theme'
import { NativeSheet } from './native-sheet'
import { YouVersionPlatformLogo, youVersionPlatformLogoSize } from './youversion-platform-logo'

/**
 * Text and stroke colors for the sheet body. The sheet *surface* comes from
 * `NativeSheet`'s Sheet Surface Parity tokens; these are the on-surface colors,
 * and the stroke matches the swatch-circle border the Web SDK draws inside the
 * reader (`rgba(18,18,18,0.2)` / `rgba(255,255,255,0.2)`).
 */
const FOREGROUND: Record<Theme, string> = { light: '#121212', dark: '#ffffff' }
const MUTED_FOREGROUND: Record<Theme, string> = { light: '#6b6a6a', dark: '#a8a5a5' }
const STROKE: Record<Theme, string> = {
  light: 'rgba(18, 18, 18, 0.2)',
  dark: 'rgba(255, 255, 255, 0.2)',
}

/** Wide enough to read at the sheet's width, narrow enough to leave margin. */
const WORDMARK_WIDTH = 190
const BUTTON_WIDTH = 260

export type SignInWithYouVersionSheetProps = {
  isOpen: boolean
  /** "Yes Please" — launch the OAuth sign-in flow. */
  onConfirm: () => void
  /**
   * "No Thanks", a swipe-down, or a backdrop tap. Every one of them is a cancel,
   * and every cancel clears the Pending Highlight.
   */
  onDismiss: () => void
  theme: Theme
}

/**
 * "Sign in with YouVersion" introduction sheet, shown when a signed-out user
 * taps a highlight color and before OAuth launches.
 *
 * A sheet rather than an alert, deliberately: the Swift reference makes the
 * sign-in prompt the only full sheet in the highlight flow (the just-in-time
 * permission prompt and both sign-out dialogs are native alerts). Copy is
 * verbatim from the Swift SDK's `SignInWithYouVersionView` (`signIn.*`).
 *
 * Presentational only — it performs no OAuth and reads no config beyond the
 * app's own display name.
 */
export function SignInWithYouVersionSheet({
  isOpen,
  onConfirm,
  onDismiss,
  theme,
}: SignInWithYouVersionSheetProps) {
  const { t } = useSdkTranslation()
  const appName = resolveAppName()
  const logoSize = useMemo(() => youVersionPlatformLogoSize(WORDMARK_WIDTH), [])

  return (
    <NativeSheet isOpen={isOpen} onClose={onDismiss} theme={theme}>
      <View testID="sign-in-with-youversion-sheet" style={styles.container}>
        <Text style={[styles.eyebrow, { color: MUTED_FOREGROUND[theme] }]}>
          {t('signIn.introducing')}
        </Text>

        {/*
          The wordmark's label has no canonical Swift key — it is an
          accessibility affordance the Swift asset doesn't carry. Reusing the
          React Web SDK's existing key for the same asset rather than coining a
          new one.
        */}
        <YouVersionPlatformLogo
          theme={theme}
          accessibilityLabel={t('youVersionPlatformLogoAriaLabel')}
          width={logoSize.width}
          height={logoSize.height}
        />

        <Text style={[styles.paragraph, { color: MUTED_FOREGROUND[theme] }]}>
          {t('signIn.paragraph', { appName: appName ?? '' })}
        </Text>

        <View style={styles.actions}>
          <Pressable
            testID="sign-in-with-youversion-confirm"
            accessibilityRole="button"
            onPress={onConfirm}
            style={[styles.button, { backgroundColor: FOREGROUND[theme] }]}
          >
            <Text style={[styles.buttonLabel, { color: theme === 'dark' ? '#121212' : '#ffffff' }]}>
              {t('signIn.yesButton')}
            </Text>
          </Pressable>

          <Pressable
            testID="sign-in-with-youversion-decline"
            accessibilityRole="button"
            onPress={onDismiss}
            style={[styles.button, { borderColor: STROKE[theme] }]}
          >
            <Text style={[styles.buttonLabel, { color: FOREGROUND[theme] }]}>
              {t('signIn.noButton')}
            </Text>
          </Pressable>
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
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  button: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    justifyContent: 'center',
    paddingVertical: 14,
    width: BUTTON_WIDTH,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
})
