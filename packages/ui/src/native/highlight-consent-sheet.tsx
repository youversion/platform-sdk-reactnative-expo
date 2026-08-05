import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useSdkTranslation } from '../i18n/use-sdk-translation'
import type { Theme } from '../lib/resolve-theme'
import { NativeSheet } from './native-sheet'

/**
 * On-surface colors, drawn over the sheet surface `NativeSheet` supplies. They
 * match `sign-in-with-youversion-sheet.tsx` so the two prompts in the highlight
 * flow read as one family.
 */
const FOREGROUND: Record<Theme, string> = { light: '#121212', dark: '#ffffff' }
const MUTED_FOREGROUND: Record<Theme, string> = { light: '#6b6a6a', dark: '#a8a5a5' }
const STROKE: Record<Theme, string> = {
  light: 'rgba(18, 18, 18, 0.2)',
  dark: 'rgba(255, 255, 255, 0.2)',
}

const BUTTON_WIDTH = 260

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
 * and `onDismiss` its `decline()`.
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
        <Text accessibilityRole="header" style={[styles.heading, { color: FOREGROUND[theme] }]}>
          {t('dataExchangeHighlightsQuestion')}
        </Text>

        <Text style={[styles.paragraph, { color: MUTED_FOREGROUND[theme] }]}>
          {t('dataExchangeHighlightsExplanation')}
        </Text>

        <View style={styles.actions}>
          <Pressable
            testID="highlight-consent-confirm"
            accessibilityRole="button"
            onPress={onConfirm}
            style={[styles.button, { backgroundColor: FOREGROUND[theme] }]}
          >
            <Text style={[styles.buttonLabel, { color: theme === 'dark' ? '#121212' : '#ffffff' }]}>
              {t('dataExchangeContinue')}
            </Text>
          </Pressable>

          <Pressable
            testID="highlight-consent-cancel"
            accessibilityRole="button"
            onPress={onDismiss}
            style={[styles.button, { borderColor: STROKE[theme] }]}
          >
            <Text style={[styles.buttonLabel, { color: FOREGROUND[theme] }]}>{t('cancel')}</Text>
          </Pressable>
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
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actions: {
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
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
