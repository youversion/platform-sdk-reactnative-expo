'use dom'

import { withDomBridgeRecovery } from '../lib/dom-bridge-recovery'

import type { YVUserInfo } from '@youversion/platform-react-native-expo-core'
import type {
  BibleChapterPickerPressData,
  BibleVersionPickerPressData,
  FootnoteData,
} from '@youversion/platform-react-ui'
import { BibleReader } from '@youversion/platform-react-ui'
import type { ComponentType, ReactNode } from 'react'
import { useEffect } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { applyAuthToken, applySDKConfig } from '../lib'

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
  bottomSafeArea?: number
  dom?: import('expo/dom').DOMProps
}

export type BibleReaderProps = BibleReaderBaseProps &
  (
    | { includeAuth: true; authRedirectUrl: string }
    | { includeAuth?: false; authRedirectUrl?: never }
  )

const sanitizeCssValue = (value: string | undefined) => value?.replace(/[{};]/g, '').trim()

const READER_BOTTOM_PADDING = 48

function BibleReaderDOM(props: BibleReaderProps) {
  const {
    appKey,
    apiHost,
    installationId,
    accessToken,
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
    bottomSafeArea = 0,
  } = props
  applySDKConfig({ appKey, apiHost, installationId })
  applyAuthToken(accessToken)

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

      {bottomSafeArea > 0 && (
        <style href="yv-bible-reader-scroll-padding" precedence="medium">
          {`main:has([data-slot="yv-bible-renderer"]) {
            padding-bottom: ${READER_BOTTOM_PADDING + bottomSafeArea}px !important;
          }`}
        </style>
      )}

      <div style={{ position: 'relative', height: '100%', width: '100%' }}>
        <NativeActionBibleReaderRoot
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

const RecoveredBibleReaderDOM = withDomBridgeRecovery(BibleReaderDOM)
export default RecoveredBibleReaderDOM
