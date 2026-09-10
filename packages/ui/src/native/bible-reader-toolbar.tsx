import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import type { ViewStyle } from 'react-native'

import { Button } from '../components/ui/button'
import { Popover } from '../components/ui/popover'
import { useTokens } from '../hooks/use-tokens'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import type { Tokens } from '../theme'
import { ChevronLeftIcon } from './icons/chevron-left-icon'
import { ChevronRightIcon } from './icons/chevron-right-icon'
import { FontSettingsIcon } from './icons/font-settings-icon'
import { MoreIcon } from './icons/more-icon'
import { PersonIcon } from './icons/person-icon'

function ToolbarAuthItem({
  showAuth,
  signedIn,
  onSignInPress,
  onSignOutPress,
}: {
  showAuth: boolean
  signedIn: boolean
  onSignInPress?: () => void
  onSignOutPress?: () => void
}): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()

  if (!showAuth) {
    return null
  }

  if (signedIn) {
    return (
      <Popover.Close
        onPress={onSignOutPress}
        testID="reader-toolbar-sign-out"
        style={styles.menuItem}
      >
        <PersonIcon color={tokens.foreground} size={20} />
        <Popover.Text>{t('signOut')}</Popover.Text>
      </Popover.Close>
    )
  }

  return (
    <Popover.Close
      onPress={onSignInPress}
      testID="reader-toolbar-sign-in"
      style={styles.menuItem}
    >
      <PersonIcon color={tokens.foreground} size={20} />
      <Popover.Text>{t('signIn')}</Popover.Text>
    </Popover.Close>
  )
}

function ChapterContent({
  bookLabel,
  isBookTitleLoading,
  chapter,
}: {
  bookLabel: string
  isBookTitleLoading: boolean
  chapter: string
}): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()

  if (isBookTitleLoading) {
    return (
      <ActivityIndicator
        size="small"
        color={tokens.foreground}
        accessibilityLabel={t('loading')}
        testID="reader-toolbar-chapter-loading"
      />
    )
  }

  if (bookLabel.length > 0) {
    return <Button.Text>{`${bookLabel} ${chapter}`}</Button.Text>
  }

  return <Button.Text>{chapter}</Button.Text>
}

function pillStyle(tokens: Tokens): ViewStyle {
  return {
    backgroundColor: tokens.background,
    borderRadius: tokens.radius.full,
    shadowColor: tokens.foreground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  }
}

export type BibleReaderToolbarProps = {
  bookLabel: string
  isBookTitleLoading: boolean
  chapter: string
  versionLabel: string
  canGoPrevious: boolean
  canGoNext: boolean
  showAuth: boolean
  signedIn: boolean
  onChapterPress: () => void
  onPreviousChapterPress: () => void
  onNextChapterPress: () => void
  onVersionPress: () => void
  onSettingsPress: () => void
  onSignInPress?: () => void
  onSignOutPress?: () => void
}

/** Native row of Reader triggers. Opens the existing sheets. Not a public export. */
export function BibleReaderToolbar({
  bookLabel,
  isBookTitleLoading,
  chapter,
  versionLabel,
  canGoPrevious,
  canGoNext,
  showAuth,
  signedIn,
  onChapterPress,
  onPreviousChapterPress,
  onNextChapterPress,
  onVersionPress,
  onSettingsPress,
  onSignInPress,
  onSignOutPress,
}: BibleReaderToolbarProps): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()
  const pill = pillStyle(tokens)

  return (
    <View testID="reader-toolbar" style={[styles.row, { backgroundColor: tokens.background }]}>
      <View style={[styles.chapterGroup, pill]}>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canGoPrevious}
          onPress={onPreviousChapterPress}
          accessibilityLabel={t('previousChapterAriaLabel')}
          testID="reader-toolbar-previous-chapter"
        >
          <Button.Icon as={ChevronLeftIcon} />
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onPress={onChapterPress}
          testID="reader-toolbar-chapter"
          style={styles.chapter}
        >
          <ChapterContent
            bookLabel={bookLabel}
            isBookTitleLoading={isBookTitleLoading}
            chapter={chapter}
          />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canGoNext}
          onPress={onNextChapterPress}
          accessibilityLabel={t('nextChapterAriaLabel')}
          testID="reader-toolbar-next-chapter"
        >
          <Button.Icon as={ChevronRightIcon} />
        </Button>
      </View>
      <Button
        variant="ghost"
        size="lg"
        onPress={onVersionPress}
        testID="reader-toolbar-version"
        style={[styles.version, pill]}
      >
        <Button.Text>{versionLabel}</Button.Text>
      </Button>
      <Popover>
        <Popover.Trigger
          testID="reader-toolbar-more"
          accessibilityLabel={t('moreMenuAriaLabel')}
          style={styles.more}
        >
          <MoreIcon color={tokens.foreground} size={24} />
        </Popover.Trigger>
        <Popover.Content align="end">
          <Popover.Close
            onPress={onSettingsPress}
            testID="reader-toolbar-settings"
            style={styles.menuItem}
          >
            <FontSettingsIcon color={tokens.foreground} size={20} />
            <Popover.Text>{t('fontAndSettings')}</Popover.Text>
          </Popover.Close>
          <ToolbarAuthItem
            showAuth={showAuth}
            signedIn={signedIn}
            onSignInPress={onSignInPress}
            onSignOutPress={onSignOutPress}
          />
        </Popover.Content>
      </Popover>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
  },
  chapterGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  chapter: {
    flex: 1,
    minWidth: 0,
  },
  version: {
    flexShrink: 0,
  },
  more: {
    height: 36,
    width: 36,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
})
