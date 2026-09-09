'use dom'

import type { FetchBibleContent, Highlight } from '@youversion/platform-react-native-expo-core'
import {
  BibleTextView,
  type BibleTextViewProps as WebBibleTextViewProps,
  type FootnoteData,
} from '@youversion/platform-react-ui'
import type { DOMProps } from 'expo/dom'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

import { applySDKConfig, clearAuthResidue } from '../lib/dom-apply'
import { registerBibleContentAction } from '../lib/dom-content-cache'
import { ContentSizedBody } from '../lib/content-sized-body'
import { toWebError, type DomError } from '../lib/dom-error'
import type { InternalLocaleProps } from '../lib/locale-props'
import { bibleTextViewDomSurface } from '../lib/bible-text-view-dom-surface'
import type { FontFamilyToken } from '../lib/reader-fonts'
import type { InternalVersionFilterProps } from '../lib/version-filter-props'
import { YouVersionProvider } from '../lib/web-yv-provider'

type WebPassageState = NonNullable<WebBibleTextViewProps['passageState']>

type DomPassageState = Omit<WebPassageState, 'error'> & {
  error?: DomError
}

export type BibleTextViewProps = Omit<
  WebBibleTextViewProps,
  'onVerseSelect' | 'onFootnotePress' | 'theme' | 'passageState' | 'fontFamily'
> & {
  appKey: string
  apiHost: string
  installationId: string
  fetchBibleContent: FetchBibleContent
  /**
   * Must be defined on the first render — its presence latches Controlled
   * Highlights Latch. `[]` means nothing highlighted. Omitting it latches
   * self-contained fetch in the WebView; we never omit, because the token
   * stays native.
   */
  highlights: Highlight[]
  /** Resolved on native. Light/dark for the in-WebView provider — not `system`. */
  theme?: 'light' | 'dark'
  // Crosses the bridge as a token, not the canonical CSS stack — see reader-fonts.ts.
  fontFamily?: FontFamilyToken
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async “native actions”.
  onVerseSelect?: (verses: number[]) => Promise<void>
  // Expo DOM calls cross a runtime boundary (native <-> WebView), so function props are always async “native actions”.
  onFootnotePress?: (data: FootnoteData) => Promise<void>
  passageState?: DomPassageState
  dom?: DOMProps
}

type BibleTextViewDOMProps = BibleTextViewProps & InternalVersionFilterProps & InternalLocaleProps

export default function BibleTextViewDOM({
  appKey,
  apiHost,
  installationId,
  fetchBibleContent,
  highlights,
  theme,
  fontFamily,
  fontSize,
  onVerseSelect,
  onFootnotePress,
  passageState,
  permittedVersionIds,
  excludedVersionIds,
  permittedLanguageTags,
  locale,
  ...props
}: BibleTextViewDOMProps): ReactNode {
  applySDKConfig({ apiHost, appKey, installationId })
  registerBibleContentAction({ apiHost, fetchBibleContent })

  // Once per mount, not per render: there is no token to keep in sync any more,
  // only residue an older SDK version left in this WebView's `localStorage`.
  useEffect(() => {
    clearAuthResidue()
  }, [])

  // `highlights` is required, but this is the far side of a serialization
  // boundary, so a bad value arrives as `undefined` with no compile-time trace.
  // Coerce, don't just warn — the warning compiles out in production, and a
  // missing prop latches self-contained fetch in a WebView that has no token.
  const safeHighlights = Array.isArray(highlights) ? highlights : []
  if (process.env.NODE_ENV !== 'production' && !Array.isArray(highlights)) {
    console.error(
      `[YouVersion SDK] BibleTextView received a non-array \`highlights\` prop. Omitting this prop latches self-contained fetch in the WebView. Pass \`[]\` for "nothing highlighted".`,
    )
  }

  const webPassageState: WebBibleTextViewProps['passageState'] =
    passageState != null
      ? {
          ...passageState,
          error: toWebError(passageState.error),
        }
      : undefined

  const surface = bibleTextViewDomSurface({ theme, fontFamily, fontSize })

  return (
    <YouVersionProvider
      appKey={appKey}
      theme={surface.theme}
      permittedVersionIds={permittedVersionIds}
      excludedVersionIds={excludedVersionIds}
      permittedLanguageTags={permittedLanguageTags}
      locale={locale}
    >
      <ContentSizedBody />
      <BibleTextView
        {...props}
        highlights={safeHighlights}
        fontSize={surface.fontSize}
        fontFamily={surface.fontFamily}
        passageState={webPassageState}
        onVerseSelect={
          onVerseSelect
            ? (verses) => {
                void onVerseSelect(verses)
              }
            : undefined
        }
        onFootnotePress={
          onFootnotePress
            ? (data) => {
                void onFootnotePress(data)
              }
            : undefined
        }
      />
    </YouVersionProvider>
  )
}
