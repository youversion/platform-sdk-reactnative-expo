import {
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_700Bold,
  Inter_700Bold_Italic,
} from '@expo-google-fonts/inter'
import {
  SourceSerif4_400Regular,
  SourceSerif4_400Regular_Italic,
  SourceSerif4_700Bold,
  SourceSerif4_700Bold_Italic,
} from '@expo-google-fonts/source-serif-4'
import { ScriptureTextView } from '@youversion/platform-react-native-expo-ui'
import { useFonts } from 'expo-font'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, Text, useColorScheme, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * Passages chosen to exercise the native renderer's open device-proof items
 * (ADR 0010). Each isolates a fidelity gap so an Android pass can confirm or refute
 * it against the WebView `BibleReader` on the "Bible" tab.
 */
const PASSAGES = [
  // Control: every footnote here sits on a plain `.p` prose paragraph (RN bubble path),
  // so tapping one does NOT go through the native hanging module. Use it to tell whether
  // the footnote-sheet shift is the sheet itself vs the native paragraph.
  { label: 'John 3', usfm: 'JHN.3', proves: 'prose footnotes (no native module)' },
  // Prose + footnotes, including verses that run across blocks (the cross-block
  // footnote fix). Tap a footnote marker → the drawer should show the whole verse.
  { label: 'Acts 15', usfm: 'ACT.15', proves: 'footnotes · cross-block verses' },
  // OT prose dense with the divine name (`.nd` → small-caps). On Android, watch for
  // "LORD"/"GOD" rendering as plain caps — fontVariant small-caps is spotty there.
  { label: 'Exodus 20', usfm: 'EXO.20', proves: 'small caps (divine name)' },
  // Poetry (`.q1`/`.q2`) plus the divine name. With the native hanging-paragraph module
  // wired (ADR 0011), wrapped poetic lines should hang at the wrapped-line position —
  // narrow/rotate the device to force a wrap and confirm. Small caps still iOS-only.
  { label: 'Psalm 23', usfm: 'PSA.23', proves: 'native hang-indent · small caps' },
] as const

/**
 * Native (non-WebView) scripture reader demo. Fetches the selected passage live via
 * the hooks package (`usePassage`, inside `ScriptureTextView`) and renders it with
 * the curated USFM → React Native style map. Compare against the WebView
 * `BibleReader` on the "Bible" tab — Android is the priority surface.
 */
export default function NativeReaderScreen() {
  const isDark = useColorScheme() === 'dark'
  const { top } = useSafeAreaInsets()
  const background = isDark ? '#121212' : '#ffffff'
  const foreground = isDark ? '#ffffff' : '#121212'

  const [selected, setSelected] = useState(0)
  const passage = PASSAGES[selected]!

  const [fontsLoaded] = useFonts({
    SourceSerif4_400Regular,
    SourceSerif4_700Bold,
    SourceSerif4_400Regular_Italic,
    SourceSerif4_700Bold_Italic,
    Inter_400Regular,
    Inter_700Bold,
    Inter_400Regular_Italic,
    Inter_700Bold_Italic,
  })

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: background }} />
  }

  return (
    <View style={{ flex: 1, paddingTop: top, backgroundColor: background }}>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          paddingHorizontal: 16,
          paddingBottom: 8,
        }}
      >
        {PASSAGES.map((p, index) => {
          const active = index === selected
          return (
            <Pressable
              key={p.usfm}
              onPress={() => setSelected(index)}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 12,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: active ? '#2563eb' : foreground + '33',
                backgroundColor: active ? '#2563eb' : 'transparent',
              }}
            >
              <Text style={{ color: active ? '#ffffff' : foreground, fontWeight: '600' }}>
                {p.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <Text style={{ paddingHorizontal: 16, paddingBottom: 8, color: foreground + '99', fontSize: 12 }}>
        Proves: {passage.proves}
      </Text>
      <ScrollView>
        <ScriptureTextView
          key={passage.usfm}
          versionId={111}
          usfm={passage.usfm}
          // Poetry/list (`.q*`/`.li*`) blocks render through the SDK's bundled native
          // hanging-indent module (ADR 0011) by default — first line flush, wrapped lines
          // hung. Exodus 20's list items and Psalm 23's poetry are the proof cases. No
          // app-side wiring needed; pass `renderHangingParagraph` only to override.
          onVersePress={(verse) =>
            Alert.alert('Verse selected', `${passage.label}:${verse}`)
          }
        />
      </ScrollView>
    </View>
  )
}
