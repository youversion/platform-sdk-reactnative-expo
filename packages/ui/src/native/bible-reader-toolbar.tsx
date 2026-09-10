import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import type { TextStyle } from 'react-native'

import { Avatar } from '../components/ui/avatar'
import { Button } from '../components/ui/button'
import { Popover } from '../components/ui/popover'
import { useTokens } from '../hooks/use-tokens'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import type { Tokens } from '../theme'
import { sansFace } from '../theme/fonts'
import { ChevronLeftIcon } from './icons/chevron-left-icon'
import { ChevronRightIcon } from './icons/chevron-right-icon'
import { GearIcon } from './icons/gear-icon'
import { PersonIcon } from './icons/person-icon'

function boldLabelStyle(tokens: Tokens): TextStyle {
  return sansFace(tokens.fontFamily.sans, 700)
}

function ToolbarUserMenu({
  showAuth,
  signedIn,
  avatarUrl,
  name,
  onSignInPress,
  onSignOutPress,
}: {
  showAuth: boolean
  signedIn: boolean
  avatarUrl?: string
  name?: string
  onSignInPress?: () => void
  onSignOutPress?: () => void
}): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()

  if (!showAuth) {
    return null
  }

  if (signedIn) {
    let portrait = <Avatar.Fallback name={name} />
    if (avatarUrl !== undefined && avatarUrl.length > 0) {
      portrait = (
        <>
          <Avatar.Fallback name={name} />
          <Avatar.Image uri={avatarUrl} />
        </>
      )
    }

    return (
      <Popover>
        <Popover.Trigger
          testID="reader-toolbar-avatar"
          accessibilityLabel={name?.trim() || t('signOut')}
          style={[
            styles.iconHit,
            {
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.background,
            },
          ]}
        >
          <Avatar>{portrait}</Avatar>
        </Popover.Trigger>
        <Popover.Content align="start" style={styles.userMenu}>
          <Popover.Close
            onPress={onSignOutPress}
            testID="reader-toolbar-sign-out"
            style={styles.menuItem}
          >
            <Popover.Text>{t('signOut')}</Popover.Text>
          </Popover.Close>
        </Popover.Content>
      </Popover>
    )
  }

  return (
    <Popover>
      <Popover.Trigger
        testID="reader-toolbar-user"
        accessibilityLabel={t('signIn')}
        style={[styles.iconHit, { backgroundColor: tokens.muted }]}
      >
        <PersonIcon color={tokens.foreground} size={24} />
      </Popover.Trigger>
      <Popover.Content align="start" style={styles.userMenu}>
        <Popover.Close
          onPress={onSignInPress}
          testID="reader-toolbar-sign-in"
          style={styles.menuItem}
        >
          <Popover.Text>{t('signIn')}</Popover.Text>
        </Popover.Close>
      </Popover.Content>
    </Popover>
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
  const bold = boldLabelStyle(tokens)

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
    return <Button.Text style={bold}>{`${bookLabel} ${chapter}`}</Button.Text>
  }

  return <Button.Text style={bold}>{chapter}</Button.Text>
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
  avatarUrl?: string
  name?: string
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
  avatarUrl,
  name,
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

  return (
    <View
      testID="reader-toolbar"
      style={[
        styles.row,
        { backgroundColor: tokens.background, borderBottomColor: tokens.border },
      ]}
    >
      <ToolbarUserMenu
        showAuth={showAuth}
        signedIn={signedIn}
        avatarUrl={avatarUrl}
        name={name}
        onSignInPress={onSignInPress}
        onSignOutPress={onSignOutPress}
      />
      <View
        style={[
          styles.chapterGroup,
          { backgroundColor: tokens.muted, borderRadius: tokens.radius.full },
        ]}
      >
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
          variant="secondary"
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
        variant="secondary"
        size="lg"
        onPress={onVersionPress}
        testID="reader-toolbar-version"
        style={styles.version}
      >
        <Button.Text style={boldLabelStyle(tokens)}>{versionLabel}</Button.Text>
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onPress={onSettingsPress}
        accessibilityLabel={t('fontAndSettings')}
        testID="reader-toolbar-settings"
      >
        <Button.Icon as={GearIcon} />
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chapterGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
    overflow: 'hidden',
  },
  chapter: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
  },
  version: {
    flexShrink: 0,
    paddingHorizontal: 16,
  },
  iconHit: {
    height: 36,
    width: 36,
  },
  userMenu: {
    width: 160,
    padding: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
})
