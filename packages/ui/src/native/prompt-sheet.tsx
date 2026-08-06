import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import {
  SHEET_FOREGROUND,
  SHEET_INVERSE_FOREGROUND,
  SHEET_MUTED_FOREGROUND,
  SHEET_STROKE,
} from '../lib/native-sheet-theme'
import type { Theme } from '../lib/resolve-theme'

/**
 * The shared body parts of a **prompt sheet**: a `NativeSheet` that asks one
 * question and offers a confirm and a decline.
 *
 * `SignInWithYouVersionSheet` and `HighlightConsentSheet` are the two prompt
 * sheets, and they run back to back in the highlight flow. A signed-out swatch
 * tap can raise the first and then the second, so they have to read as one
 * family. The button shape and the supporting paragraph therefore live here
 * instead of in both files. Each sheet still owns its own `NativeSheet`,
 * container, and headline, which is where they differ.
 */

/** Wide enough for the longest localized label, narrow enough to leave margin at the sheet's edge. */
const BUTTON_WIDTH = 260

export type PromptSheetButtonProps = {
  label: string
  onPress: () => void
  /** `'primary'` fills with the foreground and inverts its label. `'secondary'` is outlined. */
  variant: 'primary' | 'secondary'
  theme: Theme
  testID: string
}

/** One stacked, full-width action button in a prompt sheet's confirm/decline pair. */
export function PromptSheetButton({
  label,
  onPress,
  variant,
  theme,
  testID,
}: PromptSheetButtonProps) {
  const isPrimary = variant === 'primary'

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.button,
        isPrimary
          ? { backgroundColor: SHEET_FOREGROUND[theme] }
          : { borderColor: SHEET_STROKE[theme] },
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          { color: isPrimary ? SHEET_INVERSE_FOREGROUND[theme] : SHEET_FOREGROUND[theme] },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/** Centered supporting copy under a prompt sheet's headline. */
export function PromptSheetParagraph({ children, theme }: { children: ReactNode; theme: Theme }) {
  return (
    <Text style={[styles.paragraph, { color: SHEET_MUTED_FOREGROUND[theme] }]}>{children}</Text>
  )
}

const styles = StyleSheet.create({
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
