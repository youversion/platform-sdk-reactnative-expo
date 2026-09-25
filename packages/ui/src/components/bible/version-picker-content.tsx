import { useEffect, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import { useTokens } from '../../hooks/use-tokens'
import { useLocale } from '../../i18n/locale-context'
import { useSdkTranslation } from '../../i18n/use-sdk-translation'
import type { VersionPickerPanel } from '../../lib/version-picker-panels'
import { sansFace } from '../../theme/fonts'
import { ClearIcon } from '../icons/clear-icon'
import { SearchIcon } from '../icons/search-icon'
import { Button, Tabs, Text } from '../ui'
import type {
  VersionPickerLanguage,
  VersionPickerVersion,
} from '../../native/bible-version-picker-api'
import type {
  VersionPickerController,
  VersionPickerLanguageTab,
  VersionPickerLoadState,
} from './use-version-picker'

const SIDE_PADDING = 20
const LIST_GAP = 8

function languageTabValue(value: string): VersionPickerLanguageTab | null {
  if (value === 'suggested' || value === 'all') {
    return value
  }
  return null
}

export type VersionPickerContentProps = {
  controller: VersionPickerController
  style?: StyleProp<ViewStyle>
}

function SearchField({
  value,
  onChange,
  placeholder,
  accessibilityLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  accessibilityLabel: string
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
        {
          backgroundColor: selected ? tokens.muted : 'transparent',
          borderRadius: tokens.radius.surface,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[styles.versionBadge, { backgroundColor: tokens.muted, borderColor: tokens.border }]}
      >
        <Text variant="body" style={[styles.versionBadgeText, { color: tokens.foreground }]}>
          {version.localizedAbbreviation}
        </Text>
      </View>
      <Text variant="body" style={[styles.versionTitle, { color: tokens.foreground }]}>
        {version.title}
      </Text>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={primary}
      onPress={onPress}
      style={({ pressed }) => [
        styles.languageRow,
        {
          backgroundColor: selected ? tokens.muted : 'transparent',
          borderRadius: tokens.radius.surface,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text variant="body" style={[styles.languagePrimary, { color: tokens.foreground }]}>
        {primary}
      </Text>
      {secondary ? (
        <Text variant="body" style={[styles.languageSecondary, { color: tokens.mutedForeground }]}>
          {secondary}
        </Text>
      ) : null}
    </Pressable>
  )
}

function VersionsPanel({
  visible,
  loadState,
  selectedVersionId,
  pendingVersionId,
  recentVersions,
  filteredVersions,
  versionSearchQuery,
  versionLookupFailed,
  onVersionSearchChange,
  onOpenLanguagePanel,
  onSelectVersion,
  onRetry,
}: {
  visible: boolean
  loadState: VersionPickerLoadState
  selectedVersionId: number
  pendingVersionId: number | null
  recentVersions: readonly VersionPickerVersion[]
  filteredVersions: readonly VersionPickerVersion[]
  versionSearchQuery: string
  versionLookupFailed: boolean
  onVersionSearchChange: (query: string) => void
  onOpenLanguagePanel: () => void
  onSelectVersion: (version: VersionPickerVersion) => void
  onRetry: () => void
}): ReactNode {
  const tokens = useTokens()
  const { t } = useSdkTranslation()

  return (
    <View
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.panel, !visible && styles.hiddenPanel]}
    >
      <View style={styles.languageTriggerRow}>
        <Button variant="ghost" size="sm" onPress={onOpenLanguagePanel}>
          <Button.Text>{t('language')}</Button.Text>
        </Button>
      </View>
      <View style={styles.list}>
        <ScrollView
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
        >
          {loadState.status === 'loading' ? (
            <View style={styles.centerState}>
              <ActivityIndicator accessibilityLabel={t('loading')} color={tokens.foreground} />
            </View>
          ) : loadState.status === 'error' ? (
            <StateMessage label={t('error')} action={t('retry')} onAction={onRetry} />
          ) : (
            <>
              {recentVersions.length > 0 ? (
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
              ) : null}
              {versionLookupFailed ? (
                <StateMessage label={t('error')} action={t('retry')} onAction={onRetry} />
              ) : filteredVersions.length > 0 ? (
                <View style={styles.section}>
                  {recentVersions.length > 0 ? (
                    <Text
                      variant="body"
                      style={[styles.sectionHeading, { color: tokens.foreground }]}
                    >
                      {t('bibleVersionsHeading')}
                    </Text>
                  ) : null}
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
              ) : recentVersions.length === 0 ? (
                <View style={styles.centerState}>
                  <Text variant="body" style={{ color: tokens.mutedForeground }}>
                    {t('noVersionsFound')}
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
      <View
        style={[styles.searchBar, { backgroundColor: tokens.muted, borderColor: tokens.border }]}
      >
        <SearchField
          value={versionSearchQuery}
          onChange={onVersionSearchChange}
          placeholder={t('search')}
          accessibilityLabel={t('searchVersions')}
        />
      </View>
    </View>
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
  const isSearching = languageSearchQuery.trim().length > 0

  return (
    <View
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.panel, styles.languagePanel, !visible && styles.hiddenPanel]}
    >
      <View style={styles.languageHeader}>
        <Button variant="ghost" size="sm" onPress={onClose} accessibilityLabel={t('back')}>
          <Button.Text>{t('back')}</Button.Text>
        </Button>
        <Text variant="body" style={[styles.languageHeading, { color: tokens.foreground }]}>
          {t('selectLanguage')}
        </Text>
      </View>
      <View style={styles.list}>
        <ScrollView
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
        >
          {loadState.status === 'loading' ? (
            <View style={styles.centerState}>
              <ActivityIndicator accessibilityLabel={t('loading')} color={tokens.foreground} />
            </View>
          ) : loadState.status === 'error' ? (
            <StateMessage label={t('error')} action={t('retry')} onAction={onRetry} />
          ) : isSearching ? (
            filteredLanguages.length > 0 ? (
              filteredLanguages.map((language) => (
                <LanguageRow
                  key={language.id}
                  language={language}
                  selected={selectedLanguageId === language.id}
                  displayLocale={displayLocale}
                  onPress={() => onSelectLanguage(language.id)}
                />
              ))
            ) : null
          ) : (
            <Tabs
              value={languageTab}
              onValueChange={(value) => {
                const tab = languageTabValue(value)
                if (tab) {
                  onLanguageTabChange(tab)
                }
              }}
              style={styles.languageTabs}
            >
              <Tabs.List style={styles.languageTabList}>
                <Tabs.Trigger value="suggested">
                  <Tabs.Text>{t('suggested')}</Tabs.Text>
                </Tabs.Trigger>
                <Tabs.Trigger value="all">
                  <Tabs.Text>
                    {t('all')} ({totalLanguages})
                  </Tabs.Text>
                </Tabs.Trigger>
              </Tabs.List>
              <Tabs.Content value="suggested">
                <View style={styles.section}>
                  <Text
                    variant="body"
                    style={[styles.sectionHeading, { color: tokens.foreground }]}
                  >
                    {t('regional')}
                  </Text>
                  {suggestedLanguages.map((language) => (
                    <LanguageRow
                      key={language.id}
                      language={language}
                      selected={selectedLanguageId === language.id}
                      displayLocale={displayLocale}
                      onPress={() => onSelectLanguage(language.id)}
                    />
                  ))}
                </View>
              </Tabs.Content>
              <Tabs.Content value="all">
                <View style={styles.section}>
                  {allLanguages.map((language) => (
                    <LanguageRow
                      key={language.id}
                      language={language}
                      selected={selectedLanguageId === language.id}
                      displayLocale={displayLocale}
                      onPress={() => onSelectLanguage(language.id)}
                    />
                  ))}
                </View>
              </Tabs.Content>
            </Tabs>
          )}
        </ScrollView>
      </View>
      <View
        style={[styles.searchBar, { backgroundColor: tokens.muted, borderColor: tokens.border }]}
      >
        <SearchField
          value={languageSearchQuery}
          onChange={onLanguageSearchChange}
          placeholder={t('searchLanguages')}
          accessibilityLabel={t('searchLanguages')}
        />
      </View>
    </View>
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

export function VersionPickerContent({ controller, style }: VersionPickerContentProps): ReactNode {
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
        selectedVersionId={controller.selectedVersionId}
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
  hiddenPanel: { opacity: 0 },
  languagePanel: { ...StyleSheet.absoluteFill },
  languageTriggerRow: {
    alignItems: 'flex-end',
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 16,
    paddingBottom: 8,
  },
  languageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SIDE_PADDING,
    paddingTop: 16,
    paddingBottom: 8,
  },
  languageHeading: { fontSize: 18, lineHeight: 26 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: SIDE_PADDING, paddingBottom: 16, gap: LIST_GAP },
  centerState: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  retryButton: { paddingHorizontal: 16, paddingVertical: 8 },
  retryLabel: { textDecorationLine: 'underline' },
  section: { gap: LIST_GAP, marginBottom: 16 },
  sectionHeading: { fontSize: 18, lineHeight: 26, paddingVertical: 8 },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  versionBadge: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionBadgeText: { fontSize: 16, lineHeight: 20, textAlign: 'center' },
  versionTitle: { flex: 1, fontSize: 16, lineHeight: 22 },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  languagePrimary: { flex: 1, fontSize: 16, lineHeight: 22 },
  languageSecondary: { fontSize: 14, lineHeight: 20, textAlign: 'right' },
  searchBar: {
    marginHorizontal: SIDE_PADDING,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderRadius: 16,
  },
  search: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: { flex: 1, height: 44, fontSize: 16 },
  languageTabs: { flex: 1, gap: 16 },
  languageTabList: { alignSelf: 'stretch' },
  pressed: { opacity: 0.65 },
})
