import { requireNativeView } from 'expo'
import { useState } from 'react'
import { Platform, type StyleProp, type ViewStyle } from 'react-native'

import type { HangingParagraphProps, ScriptureRun } from './scripture-renderer'

type NativeProps = {
  runs: ScriptureRun[]
  firstIndent: number
  restIndent: number
  lineHeightMultiple: number
  onVersePress?: () => void
  onFootnotePress?: (event: { nativeEvent: { index: number } }) => void
  onSizeChange?: (event: { nativeEvent: { height: number } }) => void
  style?: StyleProp<ViewStyle>
}

// The native view is registered by this package's bundled Expo module (see
// `ios/`, `android/`, and `expo-module.config.json`), so consumers get it by
// autolinking — no app-side native module to author (ADR 0011). Resolved lazily
// and only off-web: `requireNativeView` has no view to bind on web, where the
// renderer falls back to its RN hanging-indent approximation instead.
const NativeView =
  Platform.OS === 'web' ? null : requireNativeView<NativeProps>('YouVersionScriptureParagraph')

/**
 * Native hanging-indent scripture paragraph (ADR 0011). The native view owns text
 * layout so it can apply `NSParagraphStyle.firstLineHeadIndent`/`headIndent` (iOS) and
 * `LeadingMarginSpan` (Android) — the only faithful hanging indent on RN. Because a
 * native text view has no intrinsic size in Yoga, it measures itself and reports its
 * height; we hold that in state and apply it. (One extra layout pass on first render /
 * width change — stable, no reflow loop.)
 *
 * `ScriptureTextView` wires this as the default `renderHangingParagraph` on native, so
 * consumers get faithful poetry/list hanging indents with no setup. It satisfies
 * `HangingParagraphRenderer`; the JS renderer serializes each block to `runs` and the
 * indents in px.
 */
export function ScriptureParagraph({
  runs,
  firstIndent,
  restIndent,
  lineHeightMultiple = 1,
  onVersePress,
  onFootnotePress,
}: HangingParagraphProps) {
  const [height, setHeight] = useState<number | undefined>(undefined)
  if (!NativeView) return null
  return (
    <NativeView
      runs={runs}
      firstIndent={firstIndent}
      restIndent={restIndent}
      lineHeightMultiple={lineHeightMultiple}
      onVersePress={onVersePress}
      onFootnotePress={onFootnotePress ? (e) => onFootnotePress(e.nativeEvent.index) : undefined}
      onSizeChange={(event) => setHeight(event.nativeEvent.height)}
      style={{ height }}
    />
  )
}
