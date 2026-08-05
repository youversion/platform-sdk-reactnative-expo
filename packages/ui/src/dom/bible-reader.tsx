'use dom'

import type { Highlight, YVUserInfo } from '@youversion/platform-react-native-expo-core'
import type {
  BibleChapterPickerPressData,
  BibleReaderVerseSelection,
  BibleVersionPickerPressData,
  FootnoteData,
} from '@youversion/platform-react-ui'
import { BibleReader } from '@youversion/platform-react-ui'
import type { ComponentType, ReactNode } from 'react'
import { useEffect, useMemo } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { applyAuthToken, applySDKConfig } from '../lib/dom-apply'

import type { FontFamily, FontFamilyToken } from '../lib/reader-fonts'
import { decodeFontFamilyFromDom } from '../lib/reader-fonts'
import { YouVersionProvider } from '../lib/web-yv-provider'

type NativeActionBibleReaderRootProps =
  import('@youversion/platform-react-ui').BibleReaderRootProps & {
    onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
    onSignInPress?: () => Promise<void>
    onSignOutPress?: () => Promise<void>
    children?: ReactNode
  }

type BibleReaderBaseProps = {
  appKey: string
  apiHost: string
  installationId: string
  accessToken: string | null
  /**
   * Must be defined on the first render — its presence latches the reader into
   * controlled mode, and omitting it lets the WebView fetch and write highlights
   * with the token we hand it. Pass `[]` for "nothing highlighted".
   */
  highlights: Highlight[]
  /**
   * **Required, and supplied by the native wrapper — not a consumer choice.**
   *
   * `'none'` on the native platforms, where `BibleVerseActionSheet` replaces the
   * in-WebView popover. `'popover'` on web, where `NativeSheet` renders nothing:
   * switching the popover off there would leave no verse action UI at all.
   *
   * It arrives as a prop rather than being read from `Platform.OS` here because
   * this file runs inside the WebView, where `react-native`'s `Platform` is not
   * the host's. The branch itself lives in `lib/resolve-verse-actions.ts`.
   *
   * Required rather than defaulted so a new call site has to answer the question
   * — the Web SDK's own default is `'popover'`, which is wrong on native.
   */
  verseActions: 'popover' | 'none'
  /**
   * Fires on every selection change, clears included (`verses: []`). Carries the
   * selected verses, their passage ids, a localized `reference`, and `shareData`.
   */
  onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
  /** Increment to clear the current selection. Its value at mount never clears. */
  clearSelectionSignal?: number
  theme?: 'light' | 'dark'
  book?: string
  chapter?: string
  versionId?: number
  onBookChange?: (book: string) => Promise<void>
  onChapterChange?: (chapter: string) => Promise<void>
  onVersionChange?: (versionId: number) => Promise<void>
  onChapterPickerPress?: (data: BibleChapterPickerPressData) => Promise<void>
  onVersionPickerPress?: (data: BibleVersionPickerPressData) => Promise<void>
  onSignInPress?: () => Promise<void>
  onSignOutPress?: () => Promise<void>
  userInfo?: YVUserInfo | null
  showToolbar?: boolean
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  onOpenBibleThemeSettings?: () => void
  onExternalLinkPress?: (url: string) => Promise<void>
  fontSize?: number
  // Crosses the bridge as a token, not the canonical CSS stack — see reader-fonts.ts.
  fontFamily?: FontFamilyToken
  lineSpacing?: number
  onFontSizeChange?: (fontSize: number) => void
  onFontFamilyChange?: (fontFamily: FontFamily) => void
  onLineSpacingChange?: (lineSpacing: number) => void
  backgroundColor?: string
  foregroundColor?: string
  style?: StyleProp<ViewStyle>
  bottomScrollPadding?: number
  dom?: import('expo/dom').DOMProps
}

export type BibleReaderProps = BibleReaderBaseProps &
  (
    | { includeAuth: true; authRedirectUrl: string }
    | { includeAuth?: false; authRedirectUrl?: never }
  )

const sanitizeCssValue = (value: string | undefined) => value?.replace(/[{};]/g, '').trim()

export default function BibleReaderDOM(props: BibleReaderProps) {
  const {
    appKey,
    apiHost,
    installationId,
    accessToken,
    highlights,
    verseActions,
    onVerseSelect,
    clearSelectionSignal,
    theme = 'light',
    book,
    chapter,
    versionId,
    onBookChange,
    onChapterChange,
    onVersionChange,
    onChapterPickerPress,
    onVersionPickerPress,
    onSignInPress,
    onSignOutPress,
    userInfo,
    onFootnotePress,
    showToolbar = true,
    onOpenBibleThemeSettings,
    onExternalLinkPress,
    fontSize,
    fontFamily,
    lineSpacing,
    onFontSizeChange,
    onFontFamilyChange,
    onLineSpacingChange,
    backgroundColor,
    foregroundColor,
    bottomScrollPadding = 0,
  } = props
  applySDKConfig({ appKey, apiHost, installationId })
  applyAuthToken(accessToken)

  // `highlights` is required, but this is the far side of a serialization
  // boundary, so a bad value arrives as `undefined` with no compile-time trace.
  // Coerce, don't just warn — the warning compiles out in production, and a
  // missing prop hands the WebView back the ability to write highlights.
  const safeHighlights = Array.isArray(highlights) ? highlights : []
  if (process.env.NODE_ENV !== 'production' && !Array.isArray(highlights)) {
    console.error(
      `[YouVersion SDK] BibleReader received a non-array \`highlights\` prop. The reader falls back to self-contained mode when this prop is missing, which lets the WebView write highlights itself. Pass \`[]\` for "nothing highlighted".`,
    )
  }

  // The Web SDK calls this synchronously and ignores the return value, but a
  // native action can only be async — so fire and forget. Catch rather than
  // `void`: expo's `marshal` rejects when the consumer's handler throws, and an
  // unattached rejection surfaces as an unhandled rejection in the DOM.
  const handleVerseSelect = useMemo(
    () =>
      onVerseSelect
        ? (selection: BibleReaderVerseSelection) => {
            // `Promise.resolve` so a sync handler (no bridge) can't throw on `.catch`.
            Promise.resolve(onVerseSelect(selection)).catch((error: unknown) => {
              console.error('[YouVersion SDK] onVerseSelect handler rejected:', error)
            })
          }
        : undefined,
    [onVerseSelect],
  )

  // fontFamily crosses the bridge as a quote-free token; resolve it back to the
  // canonical CSS stack the Web SDK expects. See lib/reader-fonts.ts.
  const resolvedFontFamily = decodeFontFamilyFromDom(fontFamily)

  useEffect(() => {
    if (!onExternalLinkPress) return
    const handleClick = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.('a')
      if (!anchor) return
      const rawHref = anchor.getAttribute('href') ?? ''
      const href = anchor.href
      const opensNewTab = anchor.getAttribute('target') === '_blank'
      // Use the raw attribute for the protocol guard so relative/hash hrefs
      // (which the browser resolves to absolute URLs in anchor.href) are not
      // accidentally intercepted as external links.
      if (!rawHref || (!opensNewTab && !/^https?:\/\//i.test(rawHref))) return
      event.preventDefault()
      void onExternalLinkPress(href)
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [onExternalLinkPress])

  const NativeActionBibleReaderRoot =
    BibleReader.Root as ComponentType<NativeActionBibleReaderRootProps>

  // fontSize/fontFamily use controlled props (not CSS overrides like bg/fg)
  // because the in-WebView toolbar also mutates them — controlled props keep
  // MMKV and the Web SDK's internal state in sync bidirectionally.
  const providerContent = (
    <>
      {/*
       * Expo's DOM host template sets `#root { display: flex; flex: 1 }` but
       * never gives `html`/`body`/`#root` an actual `height: 100%`, so the
       * reader's `h-full` chain never resolves to the viewport. Without this,
       * the WebView's native scroll moves the whole document (toolbar included)
       * instead of the reader's inner `overflow-y-auto` Content area. Re-assert
       * the height chain so the toolbar stays sticky and Content owns the scroll.
       */}
      <style href="yv-bible-reader-host-height" precedence="medium">
        {`html, body, #root { height: 100%; }`}
      </style>

      <style href="yv-bible-reader-overrides" precedence="medium">
        {`[data-slot="yv-bible-renderer"] {
          ${backgroundColor ? `--yv-reader-bg: ${sanitizeCssValue(backgroundColor)} !important;` : ''}
          ${foregroundColor ? `--yv-reader-fg: ${sanitizeCssValue(foregroundColor)} !important;` : ''}
        }`}
      </style>

      {bottomScrollPadding > 0 && (
        <style href="yv-bible-reader-scroll-padding" precedence="medium">
          {`[data-yv-sdk] > main {
            padding-bottom: ${bottomScrollPadding}px !important;
          }`}
        </style>
      )}

      <div style={{ position: 'relative', height: '100%', width: '100%' }}>
        <NativeActionBibleReaderRoot
          highlights={safeHighlights}
          verseActions={verseActions}
          onVerseSelect={handleVerseSelect}
          clearSelectionSignal={clearSelectionSignal}
          book={book}
          chapter={chapter}
          versionId={versionId}
          onBookChange={onBookChange}
          onChapterChange={onChapterChange}
          onVersionChange={onVersionChange}
          onChapterPickerPress={onChapterPickerPress}
          onVersionPickerPress={onVersionPickerPress}
          onSignInPress={onSignInPress}
          onSignOutPress={onSignOutPress}
          onFootnotePress={onFootnotePress}
          fontSize={fontSize}
          fontFamily={resolvedFontFamily}
          lineSpacing={lineSpacing}
          onFontSizeChange={onFontSizeChange}
          onFontFamilyChange={onFontFamilyChange}
          onChangeLineSpacing={onLineSpacingChange}
        >
          {showToolbar && (
            <BibleReader.Toolbar
              border="bottom"
              onOpenBibleThemeSettings={onOpenBibleThemeSettings}
            />
          )}
          <BibleReader.Content />
        </NativeActionBibleReaderRoot>
      </div>
    </>
  )

  // Map core's YVUserInfo (resolved avatarUrl) to the Web SDK's
  // YouVersionUserInfoJSON shape so the in-WebView toolbar reflects the
  // natively-owned auth state. `null` => signed out; `undefined` is preserved
  // so the provider only takes control when the host actually supplies it.
  const providerUserInfo =
    userInfo === undefined
      ? undefined
      : userInfo === null
        ? null
        : {
            id: userInfo.id,
            name: userInfo.name,
            email: userInfo.email,
            avatar_url: userInfo.avatarUrl,
          }

  return props.includeAuth ? (
    <YouVersionProvider
      includeAuth
      authRedirectUrl={props.authRedirectUrl}
      appKey={appKey}
      theme={theme}
      userInfo={providerUserInfo}
    >
      {providerContent}
    </YouVersionProvider>
  ) : (
    <YouVersionProvider appKey={appKey} theme={theme}>
      {providerContent}
    </YouVersionProvider>
  )
}
