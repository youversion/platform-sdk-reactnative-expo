import { HIGHLIGHT_COLORS, mixSrgb } from '@youversion/platform-react-native-expo-core'
import { useEffect, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type KeyboardEvent,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTokens } from '../hooks/use-tokens'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { searchListKeyboardPadding, type KeyboardFrame } from '../lib/search-list-keyboard-padding'
import { SHEET_SURFACE } from '../lib/native-sheet-theme'
import type { NoteDraft } from '../lib/note-draft'
import type { Theme } from '../lib/resolve-theme'
import { sansFace } from '../theme/fonts'
import { BookmarkIcon } from './icons/bookmark-icon'
import { CheckIcon } from './icons/check-icon'
import { ChevronLeftIcon } from './icons/chevron-left-icon'
import { NativeSheet } from './native-sheet'

const SWATCH_SIZE = 28

type BibleNoteComposerProps = {
  isOpen: boolean
  draft: NoteDraft
  saving: boolean
  theme: Theme
  onChangeText: (text: string) => void
  onToggleVisibility: () => void
  onSelectColor: (color: string | null) => void
  onDismiss: () => void
  onSave: () => void
  /** Bumps when a swipe should snap the sheet back open. */
  openKey: number
}

function swatchFill(stored: string, theme: Theme): string {
  try {
    const mix = theme === 'dark' ? 0.2 : 1
    return `#${mixSrgb(stored, SHEET_SURFACE[theme], mix)}`
  } catch {
    return SHEET_SURFACE[theme]
  }
}

function useComposerKeyboardPadding(isOpen: boolean): number {
  const { height } = useWindowDimensions()
  const { bottom } = useSafeAreaInsets()
  const [keyboard, setKeyboard] = useState<KeyboardFrame | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setKeyboard(null)
      return
    }
    const onShow = (event: KeyboardEvent) => {
      const { screenY, height: keyboardHeight } = event.endCoordinates
      setKeyboard({ screenY, height: keyboardHeight })
    }
    const onHide = () => setKeyboard(null)
    const subscriptions = [
      Keyboard.addListener('keyboardWillShow', onShow),
      Keyboard.addListener('keyboardDidShow', onShow),
      Keyboard.addListener('keyboardWillHide', onHide),
      Keyboard.addListener('keyboardDidHide', onHide),
    ]
    return () => {
      for (const subscription of subscriptions) {
        subscription.remove()
      }
    }
  }, [isOpen])

  return searchListKeyboardPadding(height, bottom, keyboard)
}

export function BibleNoteComposer({
  isOpen,
  draft,
  saving,
  theme,
  onChangeText,
  onToggleVisibility,
  onSelectColor,
  onDismiss,
  onSave,
  openKey,
}: BibleNoteComposerProps): ReactNode {
  const { t } = useSdkTranslation()
  const tokens = useTokens()
  const keyboardPadding = useComposerKeyboardPadding(isOpen)
  const visibilityLabel = draft.visibility === 'public' ? t('notesPublic') : t('notesPrivate')

  return (
    <NativeSheet isOpen={isOpen} openKey={openKey} onClose={onDismiss} theme={theme}>
      <View
        testID="bible-note-composer"
        style={[styles.body, { paddingBottom: 16 + keyboardPadding }]}
      >
        <Pressable
          testID="bible-note-back"
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          disabled={saving}
          onPress={onDismiss}
          style={styles.back}
        >
          <ChevronLeftIcon color={tokens.foreground} size={22} />
        </Pressable>

        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <BookmarkIcon color={tokens.foreground} size={18} />
            <View style={styles.titles}>
              <Text style={[styles.saveLabel, sansFace(tokens.fontFamily.sans, 700), { color: tokens.foreground }]}>
                {t('notesSave')}
              </Text>
              {draft.title.length > 0 ? (
                <Text
                  testID="bible-note-reference"
                  style={[styles.reference, sansFace(tokens.fontFamily.sans, 400), { color: tokens.mutedForeground }]}
                >
                  {draft.title}
                </Text>
              ) : null}
            </View>
          </View>
          <Pressable
            testID="bible-note-visibility"
            accessibilityRole="button"
            accessibilityLabel={visibilityLabel}
            disabled={saving}
            onPress={onToggleVisibility}
            style={[styles.pill, { borderColor: tokens.border, backgroundColor: tokens.background }]}
          >
            <Text style={[styles.pillLabel, sansFace(tokens.fontFamily.sans, 400), { color: tokens.foreground }]}>
              {visibilityLabel}
            </Text>
          </Pressable>
        </View>

        <TextInput
          testID="bible-note-text"
          value={draft.text}
          onChangeText={onChangeText}
          editable={!saving}
          multiline
          placeholder={t('notesPlaceholder')}
          placeholderTextColor={tokens.mutedForeground}
          style={[
            styles.input,
            sansFace(tokens.fontFamily.sans, 400),
            { color: tokens.foreground, backgroundColor: tokens.muted },
          ]}
        />

        <View testID="bible-note-colors" style={styles.swatches}>
          {HIGHLIGHT_COLORS.map((color) => {
            const selected = draft.color === color
            return (
              <Pressable
                key={color}
                testID={`bible-note-color-${color}`}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                disabled={saving}
                onPress={() => onSelectColor(selected ? null : color)}
                style={[styles.swatch, { backgroundColor: swatchFill(color, theme), borderColor: tokens.border }]}
              >
                {selected ? <CheckIcon color={tokens.foreground} size={16} /> : null}
              </Pressable>
            )
          })}
        </View>

        <View style={styles.actions}>
          <Pressable
            testID="bible-note-cancel"
            accessibilityRole="button"
            disabled={saving}
            onPress={onDismiss}
          >
            <Text style={[styles.cancel, sansFace(tokens.fontFamily.sans, 400), { color: tokens.foreground }]}>
              {t('cancel')}
            </Text>
          </Pressable>
          <Pressable
            testID="bible-note-save"
            accessibilityRole="button"
            accessibilityLabel={t('notesSave')}
            disabled={saving}
            onPress={onSave}
            style={[styles.saveButton, { backgroundColor: tokens.foreground, opacity: saving ? 0.5 : 1 }]}
          >
            {saving ? <ActivityIndicator color={tokens.background} /> : null}
            <Text style={[styles.saveText, sansFace(tokens.fontFamily.sans, 700), { color: tokens.background }]}>
              {t('notesSave')}
            </Text>
          </Pressable>
        </View>
      </View>
    </NativeSheet>
  )
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 12,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  saveLabel: {
    fontSize: 15,
  },
  reference: {
    fontSize: 12,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  pillLabel: {
    fontSize: 12,
  },
  input: {
    minHeight: 88,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  swatches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  cancel: {
    fontSize: 16,
  },
  saveButton: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveText: {
    fontSize: 15,
  },
})
