import { useEffect, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextLayoutEvent,
  type ViewStyle,
} from 'react-native'
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'

import { useTokens } from '../../hooks/use-tokens'
import { useLocale } from '../../i18n/locale-context'
import { useSdkTranslation } from '../../i18n/use-sdk-translation'
import type { VersionPickerPanel } from '../../lib/version-picker-panels'
import { fontMapKey, sansFace } from '../../theme/fonts'
import { ClearIcon } from '../icons/clear-icon'
import { SearchIcon } from '../icons/search-icon'
import { Button, Text } from '../ui'
import type {
  VersionPickerLanguage,
  VersionPickerVersion,
} from '../../native/bible-version-picker-api'
import type {
  VersionPickerController,
  VersionPickerLanguageTab,
  VersionPickerLoadState,
} from './use-version-picker'

const SIDE_PADDING = 24
const BADGE_SIZE = 52
const BADGE_FONT_SIZE = 20
const PANEL_EASE = cubicBezier(0.23, 1, 0.32, 1)

function PickerPanel({
  visible,
  language = false,
  children,
}: {
  visible: boolean
  language?: boolean
  children: ReactNode
}): ReactNode {
  const reducedMotion = useReducedMotion()
  return (
    <Animated.View
      testID={language ? 'version-picker-languages-panel' : 'version-picker-versions-panel'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.panel,
        language && styles.languagePanel,
        {
          opacity: visible ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: reducedMotion ? '80ms' : '180ms',
          transitionTimingFunction: PANEL_EASE,
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}

function Chevron({ color, back = false }: { color: string; back?: boolean }): ReactNode {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Path
        d={back ? 'M15 3 6 12l9 9' : 'm9 3 9 9-9 9'}
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function Globe({ color }: { color: string }): ReactNode {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18" stroke={color} strokeWidth={2} />
    </Svg>
  )
}

export type VersionPickerContentProps = {
  controller: VersionPickerController
  style?: StyleProp<ViewStyle>
  onClose?: () => void
}

function SearchField({
  value,
  onChange,
  placeholder,
  accessibilityLabel,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  accessibilityLabel: string
  autoFocus?: boolean
}): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()
  return (
    <View style={[styles.search, { backgroundColor: tokens.input }]}>
      <SearchIcon color={tokens.mutedForeground} />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        placeholder={placeholder}
        placeholderTextColor={tokens.mutedForeground}
        value={value}
        onChangeText={onChange}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus={autoFocus}
        style={[
          styles.searchInput,
          { color: tokens.foreground, ...sansFace(tokens.fontFamily.sans, 400) },
        ]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('clearSearch')}
          hitSlop={10}
          onPress={() => onChange('')}
        >
          <ClearIcon color={tokens.mutedForeground} />
        </Pressable>
      ) : null}
    </View>
  )
}

function VersionAbbreviation({ text }: { text: string }): ReactNode {
  const tokens = useTokens()
  const [fittedSizes, setFittedSizes] = useState({
    prefix: BADGE_FONT_SIZE,
    digits: BADGE_FONT_SIZE,
  })
  const match = /^(.+?)(\d+)$/.exec(text)
  const prefix = match?.[1] ?? text
  const digits = match?.[2]
  const face = fontMapKey(tokens.fontFamily.serif, 700, 'normal')
  const fontSize = Math.min(fittedSizes.prefix, fittedSizes.digits)
  const textStyle = [
    styles.versionBadgeText,
    { fontFamily: face, color: tokens.foreground, fontSize, lineHeight: fontSize * 1.03 },
  ]

  const fitLine = (part: 'prefix' | 'digits', { nativeEvent: { lines } }: TextLayoutEvent) => {
    const line = lines[0]
    if (!line?.width || !line.height) return
    const size = Math.min(
      BADGE_FONT_SIZE,
      BADGE_FONT_SIZE * Math.min((BADGE_SIZE * 0.7) / line.width, (BADGE_SIZE * 0.4) / line.height),
    )
    setFittedSizes((current) =>
      Math.abs(current[part] - size) > 0.1 ? { ...current, [part]: size } : current,
    )
  }

  return (
    <View style={styles.badgeContent}>
      <Text
        variant="body"
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onTextLayout={(event) => fitLine('prefix', event)}
        style={[styles.badgeMeasure, { fontFamily: face, color: tokens.foreground }]}
      >
        {prefix}
      </Text>
      {digits ? (
        <Text
          variant="body"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onTextLayout={(event) => fitLine('digits', event)}
          style={[styles.badgeMeasure, { fontFamily: face, color: tokens.foreground }]}
        >
          {digits}
        </Text>
      ) : null}
      <Text variant="body" style={textStyle}>
        {prefix}
      </Text>
      {digits ? (
        <Text variant="body" style={textStyle}>
          {digits}
        </Text>
      ) : null}
    </View>
  )
}

function VersionRow({
  version,
  selected,
  disabled,
  onPress,
}: {
  version: VersionPickerVersion
  selected: boolean
  disabled: boolean
  onPress: () => void
}): ReactNode {
  const tokens = useTokens()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={version.title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.versionRow,
        { backgroundColor: selected ? tokens.muted : 'transparent' },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[styles.versionBadge, { backgroundColor: tokens.card, borderColor: tokens.border }]}
      >
        <VersionAbbreviation text={version.localizedAbbreviation} />
      </View>
      <Text variant="body" style={[styles.versionTitle, { color: tokens.foreground }]}>
        {version.title}
      </Text>
      <Chevron color={tokens.mutedForeground} />
    </Pressable>
  )
}

function LanguageRow({
  language,
  selected,
  displayLocale,
  onPress,
}: {
  language: VersionPickerLanguage
  selected: boolean
  displayLocale: string
  onPress: () => void
}): ReactNode {
  const tokens = useTokens()
  const primary = language.displayNames.en ?? language.id
  const secondary = language.displayNames[language.id] ?? language.displayNames[displayLocale]
  const name = secondary && secondary !== primary ? secondary : primary
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={name === primary ? name : `${name}, ${primary}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.languageRow,
        { backgroundColor: selected ? tokens.muted : 'transparent' },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.languageNames}>
        <Text variant="body" style={[styles.languagePrimary, { color: tokens.foreground }]}>
          {name}
        </Text>
        {name !== primary ? (
          <Text
            variant="body"
            style={[styles.languageSecondary, { color: tokens.mutedForeground }]}
          >
            {primary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

function VersionsPanel({
  visible,
  loadState,
  displayLocale,
  selectedVersionId,
  selectedLanguageId,
  allLanguages,
  totalLanguages,
  totalVersions,
  versionCountByLanguage,
  pendingVersionId,
  recentVersions,
  filteredVersions,
  versionSearchQuery,
  versionLookupFailed,
  onVersionSearchChange,
  onOpenLanguagePanel,
  onSelectVersion,
  onRetry,
  onClose,
}: {
  visible: boolean
  loadState: VersionPickerLoadState
  displayLocale: string
  selectedVersionId: number
  selectedLanguageId: string
  allLanguages: readonly VersionPickerLanguage[]
  totalLanguages: number
  totalVersions: number
  versionCountByLanguage: ReadonlyMap<string, number>
  pendingVersionId: number | null
  recentVersions: readonly VersionPickerVersion[]
  filteredVersions: readonly VersionPickerVersion[]
  versionSearchQuery: string
  versionLookupFailed: boolean
  onVersionSearchChange: (query: string) => void
  onOpenLanguagePanel: () => void
  onSelectVersion: (version: VersionPickerVersion) => void
  onRetry: () => void
  onClose?: () => void
}): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()
  const number = (value: number) => value.toLocaleString(displayLocale)
  const language = allLanguages.find((item) => item.id === selectedLanguageId)
  const showRecent = loadState.status === 'ready' && recentVersions.length > 0
  const showVersions =
    loadState.status === 'ready' && !versionLookupFailed && filteredVersions.length > 0
  const stickyHeaderIndices = [
    ...(showRecent ? [0] : []),
    ...(showVersions ? [showRecent ? 2 : 0] : []),
  ]

  return (
    <PickerPanel visible={visible}>
      <View style={styles.header}>
        {onClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            onPress={onClose}
            style={styles.headerAction}
          >
            <Chevron color={tokens.foreground} back />
          </Pressable>
        ) : null}
        <View style={styles.headerTitleGroup}>
          <Text variant="heading" style={styles.headerTitle}>
            {t('bibleVersionsHeading')}
          </Text>
          {loadState.status === 'ready' ? (
            <Text variant="muted" style={styles.headerSubtitle}>
              {number(totalVersions)} {t('allVersionsHeading')} · {number(totalLanguages)}{' '}
              {t('allLanguagesHeading')}
            </Text>
          ) : null}
        </View>
        {onClose ? <View style={styles.headerAction} /> : null}
      </View>
      <View style={styles.searchContainer}>
        <SearchField
          value={versionSearchQuery}
          onChange={onVersionSearchChange}
          placeholder={t('searchVersions')}
          accessibilityLabel={t('searchVersions')}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('language')}
        onPress={onOpenLanguagePanel}
        style={({ pressed }) => [styles.languageTriggerRow, pressed && styles.pressed]}
      >
        <Globe color={tokens.foreground} />
        <Text variant="body" style={styles.languageTriggerLabel}>
          {t('language')}
        </Text>
        <Text variant="body" numberOfLines={1} style={styles.languageValue}>
          {language?.displayNames[displayLocale] ?? language?.displayNames.en ?? ''}
        </Text>
        {selectedLanguageId && versionCountByLanguage.has(selectedLanguageId) ? (
          <Text variant="muted" style={[styles.countBadge, { backgroundColor: tokens.muted }]}>
            {number(versionCountByLanguage.get(selectedLanguageId) ?? 0)}
          </Text>
        ) : null}
        <Chevron color={tokens.foreground} />
      </Pressable>
      <View style={styles.list}>
        <ScrollView
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          stickyHeaderIndices={stickyHeaderIndices}
        >
          {loadState.status === 'loading' && (
            <View style={styles.centerState}>
              <ActivityIndicator accessibilityLabel={t('loading')} color={tokens.foreground} />
            </View>
          )}
          {loadState.status === 'error' && (
            <StateMessage label={t('error')} action={t('retry')} onAction={onRetry} />
          )}
          {showRecent && (
            <View style={{ backgroundColor: tokens.background }}>
              <Text variant="heading" style={styles.sectionHeading}>
                {t('recentlyUsedVersionsHeading')}
              </Text>
            </View>
          )}
          {showRecent && (
            <View style={styles.section}>
              {recentVersions.map((version) => (
                <VersionRow
                  key={`recent-${version.id}`}
                  version={version}
                  selected={selectedVersionId === version.id}
                  disabled={pendingVersionId !== null}
                  onPress={() => onSelectVersion(version)}
                />
              ))}
            </View>
          )}
          {loadState.status === 'ready' && versionLookupFailed && (
            <StateMessage label={t('error')} action={t('retry')} onAction={onRetry} />
          )}
          {showVersions && (
            <View style={{ backgroundColor: tokens.background }}>
              <Text variant="heading" style={styles.sectionHeading}>
                {language?.displayNames[displayLocale] ??
                  language?.displayNames.en ??
                  t('bibleVersionsHeading')}{' '}
                {t('bibleVersionsHeading')}
              </Text>
            </View>
          )}
          {showVersions && (
            <View style={styles.section}>
              {filteredVersions.map((version) => (
                <VersionRow
                  key={version.id}
                  version={version}
                  selected={selectedVersionId === version.id}
                  disabled={pendingVersionId !== null}
                  onPress={() => onSelectVersion(version)}
                />
              ))}
            </View>
          )}
          {loadState.status === 'ready' &&
            !versionLookupFailed &&
            filteredVersions.length === 0 &&
            recentVersions.length === 0 && (
              <View style={styles.centerState}>
                <Text variant="body" style={{ color: tokens.mutedForeground }}>
                  {t('noVersionsFound')}
                </Text>
              </View>
            )}
        </ScrollView>
      </View>
    </PickerPanel>
  )
}

function LanguagesPanel({
  visible,
  loadState,
  selectedLanguageId,
  displayLocale,
  languageTab,
  languageSearchQuery,
  suggestedLanguages,
  allLanguages,
  filteredLanguages,
  totalLanguages,
  onLanguageTabChange,
  onLanguageSearchChange,
  onClose,
  onSelectLanguage,
  onRetry,
}: {
  visible: boolean
  loadState: VersionPickerLoadState
  selectedLanguageId: string
  displayLocale: string
  languageTab: VersionPickerLanguageTab
  languageSearchQuery: string
  suggestedLanguages: readonly VersionPickerLanguage[]
  allLanguages: readonly VersionPickerLanguage[]
  filteredLanguages: readonly VersionPickerLanguage[]
  totalLanguages: number
  onLanguageTabChange: (tab: VersionPickerLanguageTab) => void
  onLanguageSearchChange: (query: string) => void
  onClose: () => void
  onSelectLanguage: (languageId: string) => void
  onRetry: () => void
}): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()
  const [isSearching, setIsSearching] = useState(false)
  const languages = isSearching
    ? filteredLanguages
    : languageTab === 'suggested'
      ? suggestedLanguages
      : allLanguages

  const close = () => {
    Keyboard.dismiss()
    setIsSearching(false)
    onClose()
  }

  return (
    <PickerPanel visible={visible} language>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('backToBibleVersionsAriaLabel')}
          onPress={close}
          style={styles.headerAction}
        >
          <Chevron color={tokens.foreground} back />
        </Pressable>
        <Text variant="heading" style={styles.languageHeading}>
          {t('allLanguagesHeading')}
        </Text>
        <Button
          variant="secondary"
          size="icon"
          accessibilityLabel={isSearching ? t('cancel') : t('searchLanguages')}
          onPress={() => {
            if (isSearching) {
              onLanguageSearchChange('')
              Keyboard.dismiss()
            }
            setIsSearching(!isSearching)
          }}
          style={styles.headerAction}
        >
          <Button.Icon as={isSearching ? ClearIcon : SearchIcon} />
        </Button>
      </View>
      {isSearching ? (
        <View style={styles.searchContainer}>
          <SearchField
            value={languageSearchQuery}
            onChange={onLanguageSearchChange}
            placeholder={t('searchLanguages')}
            accessibilityLabel={t('searchLanguages')}
            autoFocus
          />
        </View>
      ) : null}
      <View style={styles.list}>
        <FlatList
          key={isSearching ? 'search' : languageTab}
          data={loadState.status === 'ready' ? languages : []}
          keyExtractor={(language) => language.id}
          renderItem={({ item: language }) => (
            <LanguageRow
              language={language}
              selected={selectedLanguageId === language.id}
              displayLocale={displayLocale}
              onPress={() => {
                setIsSearching(false)
                onSelectLanguage(language.id)
              }}
            />
          )}
          ListHeaderComponent={
            loadState.status === 'ready' && !isSearching && languageTab === 'suggested' ? (
              <Text variant="heading" style={styles.regionalHeading}>
                {t('regional')}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            loadState.status === 'loading' ? (
              <View style={styles.centerState}>
                <ActivityIndicator accessibilityLabel={t('loading')} color={tokens.foreground} />
              </View>
            ) : loadState.status === 'error' ? (
              <StateMessage label={t('error')} action={t('retry')} onAction={onRetry} />
            ) : (
              <Text variant="muted" style={styles.emptyLanguages}>
                {t(
                  isSearching
                    ? 'noLanguageSearchResults'
                    : languageTab === 'suggested'
                      ? 'noRegionalLanguagesAvailable'
                      : 'noVersionsFound',
                )}
              </Text>
            )
          }
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.languageListContent}
        />
      </View>
      {!isSearching ? (
        <View
          style={[
            styles.languageTabBar,
            { backgroundColor: tokens.muted, borderColor: tokens.border },
          ]}
        >
          {(['suggested', 'all'] as const).map((tab) => {
            const selected = languageTab === tab
            return (
              <Pressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => {
                  Keyboard.dismiss()
                  onLanguageTabChange(tab)
                }}
                style={[
                  styles.languageTabOption,
                  { borderRadius: tokens.radius.full },
                  selected && { backgroundColor: tokens.background },
                ]}
              >
                <Text
                  variant="body"
                  style={[
                    styles.languageTabLabel,
                    { color: selected ? tokens.foreground : tokens.mutedForeground },
                  ]}
                >
                  {tab === 'suggested'
                    ? t('suggested')
                    : t('allLanguagesTab', { count: totalLanguages })}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
    </PickerPanel>
  )
}

function StateMessage({
  label,
  action,
  onAction,
}: {
  label: string
  action: string
  onAction: () => void
}): ReactNode {
  const tokens = useTokens()
  return (
    <View style={styles.centerState}>
      <Text variant="body" style={{ color: tokens.mutedForeground }}>
        {label}
      </Text>
      <Pressable accessibilityRole="button" onPress={onAction} style={styles.retryButton}>
        <Text variant="body" style={[styles.retryLabel, { color: tokens.foreground }]}>
          {action}
        </Text>
      </Pressable>
    </View>
  )
}

export function VersionPickerContent({
  controller,
  style,
  onClose,
}: VersionPickerContentProps): ReactNode {
  const tokens = useTokens()
  const { lng } = useLocale()
  const panel: VersionPickerPanel = controller.panel

  useEffect(() => {
    if (panel === 'languages') {
      Keyboard.dismiss()
    }
  }, [panel])

  return (
    <View style={[styles.root, { backgroundColor: tokens.background }, style]}>
      <VersionsPanel
        visible={panel === 'versions'}
        loadState={controller.loadState}
        displayLocale={lng}
        selectedVersionId={controller.selectedVersionId}
        selectedLanguageId={controller.selectedLanguageId}
        allLanguages={controller.allLanguages}
        totalLanguages={controller.totalLanguages}
        totalVersions={controller.totalVersions}
        versionCountByLanguage={controller.versionCountByLanguage}
        pendingVersionId={controller.pendingVersionId}
        recentVersions={controller.recentVersions}
        filteredVersions={controller.filteredVersions}
        versionSearchQuery={controller.versionSearchQuery}
        versionLookupFailed={controller.versionLookupFailed}
        onVersionSearchChange={controller.setVersionSearchQuery}
        onOpenLanguagePanel={() => controller.dispatchPanelEvent('open-language')}
        onSelectVersion={(version) => {
          void controller.selectVersion(version)
        }}
        onRetry={controller.retry}
        onClose={onClose}
      />
      <LanguagesPanel
        visible={panel === 'languages'}
        loadState={controller.loadState}
        selectedLanguageId={controller.selectedLanguageId}
        displayLocale={lng}
        languageTab={controller.languageTab}
        languageSearchQuery={controller.languageSearchQuery}
        suggestedLanguages={controller.suggestedLanguages}
        allLanguages={controller.allLanguages}
        filteredLanguages={controller.filteredLanguages}
        totalLanguages={controller.totalLanguages}
        onLanguageTabChange={controller.setLanguageTab}
        onLanguageSearchChange={controller.setLanguageSearchQuery}
        onClose={() => controller.dispatchPanelEvent('close-language')}
        onSelectLanguage={controller.selectLanguage}
        onRetry={controller.retry}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: { flex: 1 },
  languagePanel: { ...StyleSheet.absoluteFill },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIDE_PADDING - 8,
    paddingTop: 12,
    paddingBottom: 16,
    minHeight: 64,
  },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitleGroup: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 22, lineHeight: 28, textAlign: 'center' },
  headerSubtitle: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  searchContainer: { paddingHorizontal: SIDE_PADDING, paddingBottom: 14 },
  languageTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SIDE_PADDING,
    minHeight: 54,
    marginBottom: 8,
  },
  languageTriggerLabel: { fontSize: 16, lineHeight: 22, flex: 1 },
  languageValue: { fontSize: 16, lineHeight: 22, maxWidth: '35%' },
  countBadge: { overflow: 'hidden', borderRadius: 12, paddingHorizontal: 6, fontSize: 12 },
  languageHeading: { flex: 1, fontSize: 18, lineHeight: 26, textAlign: 'center' },
  list: { flex: 1 },
  listContent: { paddingBottom: 24 },
  languageListContent: { paddingBottom: 24 },
  centerState: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  retryButton: { paddingHorizontal: 16, paddingVertical: 8 },
  retryLabel: { textDecorationLine: 'underline' },
  section: { marginBottom: 18 },
  sectionHeading: {
    fontSize: 22,
    lineHeight: 28,
    paddingHorizontal: SIDE_PADDING,
    paddingVertical: 12,
  },
  regionalHeading: {
    fontSize: 20,
    lineHeight: 28,
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 16,
    paddingBottom: 8,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: SIDE_PADDING,
    paddingVertical: 6,
    minHeight: 64,
  },
  versionBadge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeContent: { alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
  badgeMeasure: {
    position: 'absolute',
    width: 1000,
    opacity: 0,
    fontSize: BADGE_FONT_SIZE,
    lineHeight: BADGE_FONT_SIZE * 1.03,
    textAlign: 'left',
    includeFontPadding: false,
  },
  versionBadgeText: { width: '100%', textAlign: 'center', includeFontPadding: false },
  versionTitle: { flex: 1, fontSize: 16, lineHeight: 22 },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIDE_PADDING,
    minHeight: 52,
    paddingVertical: 8,
  },
  languageNames: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  languagePrimary: { fontSize: 16, lineHeight: 22 },
  languageSecondary: { fontSize: 12, lineHeight: 18 },
  search: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: { flex: 1, height: 52, fontSize: 16 },
  languageTabBar: {
    flexDirection: 'row',
    marginHorizontal: SIDE_PADDING,
    marginBottom: 12,
    padding: 4,
    borderWidth: 1,
    borderRadius: 9999,
  },
  languageTabOption: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  languageTabLabel: { fontSize: 14, lineHeight: 20 },
  emptyLanguages: { padding: SIDE_PADDING, textAlign: 'center' },
  pressed: { opacity: 0.65 },
})
