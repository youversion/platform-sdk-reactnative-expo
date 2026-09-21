import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Button } from '../components/ui/button'
import { Popover } from '../components/ui/popover'
import { useTokens } from '../hooks/use-tokens'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import type { Tokens } from '../theme'
import { sansFace } from '../theme/fonts'
import { MoreIcon } from './icons/more-icon'

function boldLabelStyle(tokens: Tokens): TextStyle {
  return {
    ...sansFace(tokens.fontFamily.sans, 700),
    ...tokens.typography.sm,
    lineHeight: 16,
    textAlign: 'center',
  }
}

const ICON_HIT_SLOP = 4
const HALF_PILL_HEIGHT = 40
const HALF_PILL_SPLIT = 2
const HEADER_LEADING_PADDING = 16

function moreHitStyle(tokens: Tokens): ViewStyle {
  return {
    height: HALF_PILL_HEIGHT,
    width: HALF_PILL_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radius.full,
    overflow: 'hidden',
    backgroundColor: tokens.muted,
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
      <Button.Text numberOfLines={2} style={bold}>
        {`${bookLabel} ${chapter}`}
      </Button.Text>
    )
  }

  return (
    <Button.Text numberOfLines={2} style={bold}>
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

  return (
    <View
      testID="reader-toolbar"
      style={[styles.row, { backgroundColor: tokens.background, borderBottomColor: tokens.border }]}
    >
      <View
        style={[styles.pills, { backgroundColor: tokens.muted, borderRadius: tokens.radius.full }]}
      >
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
        <View style={[styles.split, { backgroundColor: tokens.background }]} />
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
    paddingVertical: 16,
    paddingLeft: HEADER_LEADING_PADDING,
    paddingRight: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pills: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: HALF_PILL_HEIGHT,
    overflow: 'hidden',
  },
  chapter: {
    flexShrink: 1,
    minWidth: 0,
    height: HALF_PILL_HEIGHT,
    paddingHorizontal: 16,
  },
  split: {
    width: HALF_PILL_SPLIT,
    alignSelf: 'stretch',
  },
  version: {
    flexShrink: 0,
    height: HALF_PILL_HEIGHT,
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
