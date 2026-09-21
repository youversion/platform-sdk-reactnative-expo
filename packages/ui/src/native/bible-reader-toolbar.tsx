import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import type { BoxShadowValue, TextStyle, ViewStyle } from 'react-native'

import { Button } from '../components/ui/button'
import { Popover } from '../components/ui/popover'
import { useTheme, type Theme } from '../hooks/use-theme'
import { useTokens } from '../hooks/use-tokens'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { withAlpha } from '../lib/color'
import type { Tokens } from '../theme'
import { sansFace } from '../theme/fonts'
import { AaIcon } from './icons/aa-icon'
import { ChevronLeftIcon } from './icons/chevron-left-icon'
import { ChevronRightIcon } from './icons/chevron-right-icon'
import { MoreIcon } from './icons/more-icon'
import { PersonIcon } from './icons/person-icon'
import { SearchIcon } from './icons/search-icon'

function boldLabelStyle(tokens: Tokens): TextStyle {
  return {
    ...sansFace(tokens.fontFamily.sans, 700),
    ...tokens.typography.sm,
    lineHeight: 20,
    textAlign: 'center',
  }
}

const CHEVRON_HIT = 44
const CAPSULE_MIN_HEIGHT = 44
const CAPSULE_GAP = 8
const TOOLBAR_PADDING_X = 24
const MENU_ICON_SIZE = 20
const MORE_ICON_SIZE = 24
const MORE_HIT_SLOP = (CHEVRON_HIT - MORE_ICON_SIZE) / 2

function MenuRow({
  testID,
  iconTestID,
  onPress,
  icon,
  label,
}: {
  testID: string
  iconTestID: string
  onPress?: () => void
  icon: ReactNode
  label: string
}): ReactNode {
  return (
    <Popover.Close onPress={onPress} testID={testID} style={styles.menuItem}>
      <View testID={iconTestID}>{icon}</View>
      <Popover.Text numberOfLines={1}>{label}</Popover.Text>
    </Popover.Close>
  )
}

function capsuleShadow(tokens: Tokens): BoxShadowValue {
  return {
    offsetX: 0,
    offsetY: 0,
    blurRadius: 8,
    color: withAlpha(tokens.foreground, 0.19),
  }
}

function capsuleStyle(tokens: Tokens, theme: Theme): ViewStyle {
  let backgroundColor = tokens.background
  if (theme === 'dark') {
    backgroundColor = tokens.muted
  }
  const style: ViewStyle = {
    backgroundColor,
    borderRadius: tokens.radius.full,
  }
  if (theme === 'light') {
    style.boxShadow = [capsuleShadow(tokens)]
  }
  return style
}

function moreHitStyle(tokens: Tokens): ViewStyle {
  return {
    height: MORE_ICON_SIZE,
    width: MORE_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.full,
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
        hitSlop={MORE_HIT_SLOP}
        accessibilityLabel={t('moreMenuAriaLabel')}
        style={moreHitStyle(tokens)}
      >
        <MoreIcon color={tokens.foreground} size={MORE_ICON_SIZE} />
      </Popover.Trigger>
      <Popover.Content align="end" style={styles.menu}>
        <MenuRow
          testID="reader-toolbar-settings"
          iconTestID="reader-toolbar-settings-icon"
          onPress={onSettingsPress}
          icon={<AaIcon color={tokens.foreground} size={MENU_ICON_SIZE} />}
          label={t('fontAndSettings')}
        />
        {showAuth && !signedIn ? (
          <MenuRow
            testID="reader-toolbar-sign-in"
            iconTestID="reader-toolbar-sign-in-icon"
            onPress={onSignInPress}
            icon={<PersonIcon color={tokens.foreground} size={MENU_ICON_SIZE} />}
            label={t('signIn')}
          />
        ) : null}
        {showAuth && signedIn ? (
          <MenuRow
            testID="reader-toolbar-sign-out"
            iconTestID="reader-toolbar-sign-out-icon"
            onPress={onSignOutPress}
            icon={<PersonIcon color={tokens.foreground} size={MENU_ICON_SIZE} />}
            label={t('signOut')}
          />
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
  onSearchPress: () => void
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
  onSearchPress,
  onSettingsPress,
  onSignInPress,
  onSignOutPress,
}: BibleReaderToolbarProps): ReactNode {
  const tokens = useTokens()
  const theme = useTheme()
  const { t } = useSdkTranslation()
  let chapterAriaLabel = t('changeBibleBookAndChapterAriaLabel')
  if (isBookTitleLoading) {
    chapterAriaLabel = t('loading')
  }
  let versionAriaLabel = t('changeBibleVersionAriaLabel')
  if (isVersionLoading) {
    versionAriaLabel = t('loadingBibleVersionAriaLabel')
  }
  const capsule = capsuleStyle(tokens, theme)

  return (
    <View testID="reader-toolbar" style={[styles.row, { backgroundColor: tokens.background }]}>
      <View testID="reader-toolbar-chapter-capsule" style={[styles.chapterCapsule, capsule]}>
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
      <View testID="reader-toolbar-version-capsule" style={capsule}>
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
      <Button
        variant="secondary"
        size="icon"
        onPress={onSearchPress}
        accessibilityLabel={t('search')}
        testID="reader-toolbar-search"
      >
        <Button.Icon as={SearchIcon} />
      </Button>
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
    paddingHorizontal: TOOLBAR_PADDING_X,
    gap: CAPSULE_GAP,
  },
  chapterCapsule: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: CAPSULE_MIN_HEIGHT,
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
    flexShrink: 1,
    maxWidth: 96,
    minWidth: 44,
    minHeight: CAPSULE_MIN_HEIGHT,
    paddingHorizontal: 16,
  },
  menu: {
    width: 220,
    padding: 4,
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  menuItem: {
    justifyContent: 'flex-start',
    width: '100%',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
})
