import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import {
  YouVersionProvider as HooksYouVersionProvider,
  usePassage,
} from '@youversion/platform-react-hooks'
import { useMemo, useState } from 'react'
import { type ViewStyle, Platform, Text, View, useColorScheme } from 'react-native'

import { useTheme } from '../../hooks/use-theme'
import type { FontFamily } from '../../lib/reader-fonts'
import { resolveTheme, type Theme, type ThemeInput } from '../../lib/resolve-theme'
import { getSdkHeaders } from '../../lib/sdk-version'
import { applyNativeWebSdkConfig } from '../../lib/web-sdk-native-config'
import { useReaderSettingsStore } from '../../stores/reader-settings-store'
import { ScriptureFootnoteSheet } from './scripture-footnote-sheet'
import { ScriptureParagraph } from './scripture-paragraph-native'
import {
  type HangingParagraphRenderer,
  type RenderScriptureOptions,
  type ScriptureFootnote,
  renderScriptureHtml,
} from './scripture-renderer'
import { SCRIPTURE_PALETTE } from './scripture-theme'

// The bundled native hanging-indent view (ADR 0011) — shipped with this package and
// autolinked, so consumers get faithful poetry/list hanging indents without authoring a
// native module. Used as the default `renderHangingParagraph` on native; web has no
// native view, so it stays the RN approximation (undefined → renderer's uniform indent).
const NATIVE_HANGING_PARAGRAPH: HangingParagraphRenderer | undefined =
  Platform.OS === 'web' ? undefined : ScriptureParagraph

export type ScriptureTextViewProps = {
  /** Bible version id (e.g. the example app's `3034`). */
  versionId: number
  /** USFM passage reference, e.g. `"ACT.15"`. */
  usfm: string
  theme?: ThemeInput
  fontSize?: number
  fontFamily?: FontFamily
  includeHeadings?: boolean
  includeNotes?: boolean
  /** Render this HTML directly and skip `usePassage` (offline / tests). */
  html?: string
  onVersePress?: (verseNumber: string) => void
  /**
   * Override the native renderer for poetry/list **hanging** indent (ADR 0011).
   * Defaults to this package's bundled `ScriptureParagraph` native view on iOS/Android
   * (autolinked — no app-side native module needed), so `.q*`/`.li*` blocks get a
   * faithful first-line/wrapped hang out of the box. Pass a custom renderer to override,
   * or rely on the default. On web (no native view) the renderer's RN uniform-indent
   * approximation is used.
   */
  renderHangingParagraph?: HangingParagraphRenderer
  style?: ViewStyle
}

// Footnote handling is internal: the renderer surfaces a `ScriptureFootnote` to
// the built-in drawer. It is not a consumer-facing prop or export.
type FootnoteHandler = (footnote: ScriptureFootnote) => void

type PresentationProps = Pick<
  ScriptureTextViewProps,
  'usfm' | 'fontSize' | 'fontFamily' | 'onVersePress' | 'renderHangingParagraph' | 'style'
> & {
  html: string
  theme: Theme
  /** Human passage reference (e.g. `"Acts 15"`) for footnote verse references. */
  reference?: string
  onFootnotePress?: FootnoteHandler
}

/**
 * Pure presentation: settings → render options → native element tree. Used by
 * both the live and offline paths so reader settings apply identically.
 */
function ScriptureView({
  usfm,
  reference,
  html,
  theme,
  fontSize,
  fontFamily,
  onVersePress,
  onFootnotePress,
  renderHangingParagraph,
  style,
}: PresentationProps) {
  const settings = useReaderSettingsStore()
  const palette = SCRIPTURE_PALETTE[theme]

  const options: RenderScriptureOptions = {
    theme,
    fontSize: fontSize ?? settings.fontSize,
    fontFamily: fontFamily ?? settings.fontFamily,
    lineHeightMultiplier: settings.lineSpacing,
    usfm,
    reference,
    onVersePress,
    onFootnotePress,
    renderHangingParagraph,
  }

  return (
    <View style={[{ backgroundColor: palette.background, padding: 20 }, style]}>
      {renderScriptureHtml(html, options)}
    </View>
  )
}

type FetcherProps = Omit<ScriptureTextViewProps, 'theme' | 'html'> & {
  theme: Theme
  onFootnotePress?: FootnoteHandler
}

/** Live path: fetch the passage HTML via the hooks package, then render it. */
function ScriptureFetcher({
  versionId,
  usfm,
  theme,
  includeHeadings = true,
  includeNotes = true,
  fontSize,
  fontFamily,
  onVersePress,
  onFootnotePress,
  renderHangingParagraph,
  style,
}: FetcherProps) {
  const { passage, loading, error } = usePassage({
    versionId,
    usfm,
    format: 'html',
    include_headings: includeHeadings,
    include_notes: includeNotes,
  })
  const palette = SCRIPTURE_PALETTE[theme]

  if (loading && !passage) {
    return (
      <View style={[{ backgroundColor: palette.background, padding: 20 }, style]}>
        <Text style={{ color: palette.mutedForeground }}>Loading…</Text>
      </View>
    )
  }

  if (error || !passage) {
    return (
      <View style={[{ backgroundColor: palette.background, padding: 20 }, style]}>
        <Text style={{ color: palette.red }}>{error?.message ?? 'Unable to load passage.'}</Text>
      </View>
    )
  }

  return (
    <ScriptureView
      usfm={usfm}
      reference={passage.reference}
      html={passage.content}
      theme={theme}
      fontSize={fontSize}
      fontFamily={fontFamily}
      onVersePress={onVersePress}
      onFootnotePress={onFootnotePress}
      renderHangingParagraph={renderHangingParagraph}
      style={style}
    />
  )
}

/**
 * Native, non-WebView scripture reader. Fetches passage HTML through
 * `@youversion/platform-react-hooks` (`usePassage`) and renders it with the
 * curated USFM → React Native style map. Pass `html` to render a string directly
 * (offline / tests) and bypass data fetching.
 *
 * The hooks `YouVersionProvider` is mounted here, scoped to the live path, with a
 * **resolved** theme (never `'system'`, which would hit `window.matchMedia`) and
 * the RN SDK's `x-yvp-sdk` header. It reads `appKey`/`apiHost` from the native
 * `YouVersionProvider` so consumers configure the SDK once.
 */
export function ScriptureTextView(props: ScriptureTextViewProps) {
  const { appKey, apiHost, installationId } = useYouVersion()
  const themeContext = useTheme()
  const colorScheme = useColorScheme()
  const resolvedTheme = resolveTheme(props.theme ?? themeContext, colorScheme)

  // Footnotes open the built-in native drawer — internal only, no consumer hook.
  const [footnote, setFootnote] = useState<ScriptureFootnote | null>(null)
  // `footnote` can stay non-null across taps, so bump a key on each open so the
  // sheet re-snaps even when the value is unchanged.
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0)

  const showFootnoteSheet = Platform.OS !== 'web'
  // Stable across footnote taps — the setters are stable, so this handler keeps the same
  // identity and does not invalidate the memoized content below.
  const onFootnotePress: FootnoteHandler | undefined = useMemo(
    () =>
      showFootnoteSheet
        ? (data: ScriptureFootnote) => {
            setFootnote(data)
            setFootnoteOpenKey((key) => key + 1)
          }
        : undefined,
    [showFootnoteSheet],
  )

  // Seed the Web SDK's global config with our native (MMKV-backed) installation id
  // before the hooks provider renders, so its `installationId` read never falls
  // back to `localStorage` (absent in Hermes). Our native provider guarantees a
  // non-empty id here. See `applyNativeWebSdkConfig`. (No-op on the offline path.)
  if (props.html == null) applyNativeWebSdkConfig(installationId)

  // Memoized on the real inputs so opening/closing the footnote drawer (which only
  // changes `footnote`/`footnoteOpenKey`) does NOT re-render the reader. Without this,
  // every footnote tap re-runs `renderScriptureHtml`, re-applies fresh `runs` to every
  // native paragraph, and forces a re-measure — which shifts the text (ADR 0011).
  const content = useMemo(
    () =>
      props.html != null ? (
        <ScriptureView
          usfm={props.usfm}
          html={props.html}
          theme={resolvedTheme}
          fontSize={props.fontSize}
          fontFamily={props.fontFamily}
          onVersePress={props.onVersePress}
          onFootnotePress={onFootnotePress}
          renderHangingParagraph={props.renderHangingParagraph ?? NATIVE_HANGING_PARAGRAPH}
          style={props.style}
        />
      ) : (
        <HooksYouVersionProvider
          appKey={appKey}
          apiHost={apiHost}
          theme={resolvedTheme}
          additionalHeaders={getSdkHeaders()}
        >
          <ScriptureFetcher
            versionId={props.versionId}
            usfm={props.usfm}
            theme={resolvedTheme}
            includeHeadings={props.includeHeadings}
            includeNotes={props.includeNotes}
            fontSize={props.fontSize}
            fontFamily={props.fontFamily}
            onVersePress={props.onVersePress}
            onFootnotePress={onFootnotePress}
            renderHangingParagraph={props.renderHangingParagraph ?? NATIVE_HANGING_PARAGRAPH}
            style={props.style}
          />
        </HooksYouVersionProvider>
      ),
    [
      props.html,
      props.usfm,
      props.versionId,
      props.includeHeadings,
      props.includeNotes,
      props.fontSize,
      props.fontFamily,
      props.onVersePress,
      props.renderHangingParagraph,
      props.style,
      resolvedTheme,
      onFootnotePress,
      appKey,
      apiHost,
    ],
  )

  return (
    <>
      {content}
      {showFootnoteSheet && (
        <ScriptureFootnoteSheet
          footnote={footnote}
          openKey={footnoteOpenKey}
          onClose={() => setFootnote(null)}
          theme={resolvedTheme}
          fontSize={props.fontSize}
        />
      )}
    </>
  )
}
