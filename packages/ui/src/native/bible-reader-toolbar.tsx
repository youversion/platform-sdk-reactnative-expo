import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Button } from '../components/ui/button'
import { Popover } from '../components/ui/popover'
import { useTokens } from '../hooks/use-tokens'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import type { Tokens } from '../theme'
import { sansFace } from '../theme/fonts'
import { ChevronLeftIcon } from './icons/chevron-left-icon'
import { ChevronRightIcon } from './icons/chevron-right-icon'
import { MoreIcon } from './icons/more-icon'

function boldLabelStyle(tokens: Tokens): TextStyle {
  return {
    ...sansFace(tokens.fontFamily.sans, 700),
    ...tokens.typography.sm,
    lineHeight: 20,
    textAlign: 'center',
  }
}

const ICON_HIT_SLOP = 4
const CHEVRON_HIT = 44
const CAPSULE_MIN_HEIGHT = 44
const CAPSULE_GAP = 8

function capsuleStyle(tokens: Tokens): ViewStyle {
  return {
    backgroundColor: tokens.background,
    borderRadius: tokens.radius.full,
    shadowColor: tokens.foreground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  }
}

function moreHitStyle(tokens: Tokens): ViewStyle {
  return {
    height: CHEVRON_HIT,
    width: CHEVRON_HIT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.full,
    overflow: 'hidden',
  }
}

function ToolbarSpinner({ testID }: { testID: string }): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()

  return (
    <ActivityIndicator
      size="small"
      color={tokens.mutedForeground}
      accessibilityLabel={t('loading')}
      testID={testID}
    />
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
  const bold = boldLabelStyle(tokens)

  if (isBookTitleLoading) {
    return <ToolbarSpinner testID="reader-toolbar-chapter-loading" />
  }

  if (bookLabel.length > 0) {
    return (
      <Button.Text numberOfLines={1} style={bold}>
        {`${bookLabel} ${chapter}`}
      </Button.Text>
    )
  }

  return (
    <Button.Text numberOfLines={1} style={bold}>
      {chapter}
    </Button.Text>
  )
}

function VersionContent({
  versionLabel,
  isVersionLoading,
}: {
  versionLabel: string
  isVersionLoading: boolean
}): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()

  if (isVersionLoading) {
    return <ToolbarSpinner testID="reader-toolbar-version-loading" />
  }

  let label = versionLabel
  if (label.length === 0) {
    label = t('selectVersion')
  }
  return (
    <Button.Text numberOfLines={1} style={boldLabelStyle(tokens)}>
      {label}
    </Button.Text>
  )
}

function ToolbarMoreMenu({
  showAuth,
  signedIn,
  onSettingsPress,
  onSignInPress,
  onSignOutPress,
}: {
  showAuth: boolean
  signedIn: boolean
  onSettingsPress: () => void
  onSignInPress?: () => void
  onSignOutPress?: () => void
}): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()

  return (
    <Popover>
      <Popover.Trigger
        testID="reader-toolbar-menu"
        hitSlop={ICON_HIT_SLOP}
        accessibilityLabel={t('moreMenuAriaLabel')}
        style={moreHitStyle(tokens)}
      >
        <MoreIcon color={tokens.foreground} size={24} />
      </Popover.Trigger>
      <Popover.Content align="end" style={styles.menu}>
        <Popover.Close
          onPress={onSettingsPress}
          testID="reader-toolbar-settings"
          style={styles.menuItem}
        >
          <Popover.Text>{t('fontAndSettings')}</Popover.Text>
        </Popover.Close>
        {showAuth && !signedIn ? (
          <Popover.Close
            onPress={onSignInPress}
            testID="reader-toolbar-sign-in"
            style={styles.menuItem}
          >
            <Popover.Text>{t('signIn')}</Popover.Text>
          </Popover.Close>
        ) : null}
        {showAuth && signedIn ? (
          <Popover.Close
            onPress={onSignOutPress}
            testID="reader-toolbar-sign-out"
            style={styles.menuItem}
          >
            <Popover.Text>{t('signOut')}</Popover.Text>
          </Popover.Close>
        ) : null}
      </Popover.Content>
    </Popover>
  )
}

export type BibleReaderToolbarProps = {
  bookLabel: string
  isBookTitleLoading: boolean
  chapter: string
  versionLabel: string
  isVersionLoading: boolean
  showAuth: boolean
  signedIn: boolean
  canGoPrevious: boolean
  canGoNext: boolean
  onPreviousChapterPress: () => void
  onNextChapterPress: () => void
  onChapterPress: () => void
  onVersionPress: () => void
  onSettingsPress: () => void
  onSignInPress?: () => void
  onSignOutPress?: () => void
}

export function BibleReaderToolbar({
  bookLabel,
  isBookTitleLoading,
  chapter,
  versionLabel,
  isVersionLoading,
  showAuth,
  signedIn,
  canGoPrevious,
  canGoNext,
  onPreviousChapterPress,
  onNextChapterPress,
  onChapterPress,
  onVersionPress,
  onSettingsPress,
  onSignInPress,
  onSignOutPress,
}: BibleReaderToolbarProps): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()
  let chapterAriaLabel = t('changeBibleBookAndChapterAriaLabel')
  if (isBookTitleLoading) {
    chapterAriaLabel = t('loading')
  }
  let versionAriaLabel = t('changeBibleVersionAriaLabel')
  if (isVersionLoading) {
    versionAriaLabel = t('loadingBibleVersionAriaLabel')
  }
  const capsule = capsuleStyle(tokens)

  return (
    <View testID="reader-toolbar" style={[styles.row, { backgroundColor: tokens.background }]}>
      <View style={[styles.chapterCapsule, capsule]}>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canGoPrevious}
          onPress={onPreviousChapterPress}
          accessibilityLabel={t('previousChapterAriaLabel')}
          testID="reader-toolbar-previous-chapter"
          style={styles.chevron}
        >
          <Button.Icon as={ChevronLeftIcon} />
        </Button>
        <Button
          variant="ghost"
          size="lg"
          disabled={isBookTitleLoading}
          onPress={onChapterPress}
          accessibilityLabel={chapterAriaLabel}
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
          style={styles.chevron}
        >
          <Button.Icon as={ChevronRightIcon} />
        </Button>
      </View>
      <View style={capsule}>
        <Button
          variant="ghost"
          size="lg"
          disabled={isVersionLoading}
          onPress={onVersionPress}
          accessibilityLabel={versionAriaLabel}
          testID="reader-toolbar-version"
          style={styles.version}
        >
          <VersionContent versionLabel={versionLabel} isVersionLoading={isVersionLoading} />
        </Button>
      </View>
      <View style={styles.spacer} />
      <ToolbarMoreMenu
        showAuth={showAuth}
        signedIn={signedIn}
        onSettingsPress={onSettingsPress}
        onSignInPress={onSignInPress}
        onSignOutPress={onSignOutPress}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: CAPSULE_GAP,
  },
  chapterCapsule: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: CAPSULE_MIN_HEIGHT,
    overflow: 'hidden',
  },
  chevron: {
    height: CHEVRON_HIT,
    width: CHEVRON_HIT,
  },
  chapter: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    minHeight: CAPSULE_MIN_HEIGHT,
    paddingHorizontal: 8,
  },
  version: {
    flexShrink: 0,
    minHeight: CAPSULE_MIN_HEIGHT,
    paddingHorizontal: 16,
  },
  spacer: {
    flex: 1,
    minWidth: 8,
  },
  menu: {
    width: 160,
    padding: 4,
  },
  menuItem: {
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
})
