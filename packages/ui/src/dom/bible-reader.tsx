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
   * **Required, never `undefined`** — not even transiently. Presence of this
   * prop latches the Web SDK reader into controlled mode at first mount; omit it
   * and the reader fetches and writes highlights itself, inside the WebView,
   * with the token we hand it.
   *
   * `[]` is the correct value for "controlled, nothing highlighted". Native owns
   * the data; see `useHighlights` in
   * `@youversion/platform-react-native-expo-core`.
   */
  highlights: Highlight[]
  /**
   * Fires on every verse selection change, including clears (`verses: []`).
   * Under `verseActions="none"` it is the only way a host learns about a
   * selection, and it carries the localized `reference` and `shareData`.
   */
  onVerseSelect?: (selection: BibleReaderVerseSelection) => Promise<void>
  /**
   * Increment to clear the current selection from native. The value at mount is
   * the baseline, so mounting never clears.
   */
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

  // Belt and braces for the controlled-mode latch. TypeScript makes `highlights`
  // required, but this is the far side of a serialization boundary — a bad
  // native-side value arrives here as `undefined` with no compile-time trace,
  // and the failure mode (a WebView quietly writing highlights with the user's
  // token) is silent.
  //
  // Coerce rather than only warn: the warning compiles out in production, which
  // is precisely where a silent failure is unrecoverable. `[]` is the correct
  // value for "controlled, nothing highlighted", so defaulting costs nothing and
  // keeps the latch closed on the render that matters — the Web SDK decides
  // controlled vs self-contained from this prop's presence at first mount.
  const safeHighlights = Array.isArray(highlights) ? highlights : []
  if (process.env.NODE_ENV !== 'production' && !Array.isArray(highlights)) {
    console.error(
      `[YouVersion SDK] BibleReader received a non-array \`highlights\` prop. The reader falls back to self-contained mode when this prop is missing, which lets the WebView write highlights itself. Pass \`[]\` for "nothing highlighted".`,
    )
  }

  // The Web SDK calls `onVerseSelect` synchronously and ignores its return
  // value, but a native action crosses the bridge and can only be async. Adapt
  // with an explicit fire-and-forget so a selection change never depends on a
  // bridge round-trip resolving.
  //
  // Catch rather than `void`: this is arbitrary consumer code, and expo's
  // `marshal` rejects the proxy promise when a native handler throws. An
  // unattached handler would surface as an unhandled rejection inside the DOM
  // environment — the failure class this package already patches around on
  // Android. Report and swallow; a bad handler must not take the reader down.
  const handleVerseSelect = useMemo(
    () =>
      onVerseSelect
        ? (selection: BibleReaderVerseSelection) => {
            // `Promise.resolve` so a handler that returns a non-promise — the
            // shape a plain sync function takes when this component is rendered
            // without the bridge — cannot throw on `.catch`.
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
          verseActions="none"
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
