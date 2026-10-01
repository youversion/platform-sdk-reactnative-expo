// Internal POC: the same passage drawn by native <Text> and by the Expo DOM
// BibleTextView, with timings. See apps/example/native-text/.
import { useYouVersion } from '@youversion/platform-react-native-expo-core'
import { BibleTextView, useTokens } from '@youversion/platform-react-native-expo-ui'
import * as Font from 'expo-font'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { NativePassage, type LabelMode } from '../../native-text/native-passage'
import { footnoteText, parsePassage, type Block } from '../../native-text/parse-passage'

const PRESETS = [
  { label: 'Ps 119', usfm: 'PSA.119', versionId: 3034, rtl: false },
  { label: 'Ps 23', usfm: 'PSA.23', versionId: 3034, rtl: false },
  { label: 'Acts 15', usfm: 'ACT.15', versionId: 3034, rtl: false },
  { label: 'Ps 23 (ar)', usfm: 'PSA.23', versionId: 195, rtl: true },
] as const

const FONT_SIZE = 20

type Renderer = 'native' | 'dom'

type NativeTimings = {
  fetchMs: number
  cached: boolean
  transformMs: number
  walkMs: number
  layoutMs: number | null
  blocks: number
}

type DomTimings = { firstMs: number | null; settledMs: number | null; height: number }

function serifFamily(): string {
  const untitled = ['', '_italic', '_medium', '_medium_italic', '_bold', '_bold_italic']
  if (!untitled.every((suffix) => Font.isLoaded(`Untitled Serif${suffix}`)) && Font.isLoaded('Source Serif 4')) {
    return 'Source Serif 4'
  }
  return 'Untitled Serif'
}

export default function NativeTextScreen(): ReactNode {
  const { top } = useSafeAreaInsets()
  const tokens = useTokens()
  const { fetchBibleContent } = useYouVersion()
  const [presetIndex, setPresetIndex] = useState(0)
  const [renderer, setRenderer] = useState<Renderer>('native')
  const [labelMode, setLabelMode] = useState<LabelMode>('raised')
  const [run, setRun] = useState(0)
  const preset = PRESETS[presetIndex] ?? PRESETS[0]

  // `at` stamps each load; it keys the passage and anchors commit→layout.
  const [loaded, setLoaded] = useState<{ blocks: Block[]; at: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nativeTimings, setNativeTimings] = useState<NativeTimings | null>(null)
  const [domTimings, setDomTimings] = useState<DomTimings | null>(null)
  const [footnote, setFootnote] = useState<string | null>(null)
  const domMountedAt = useRef(0)

  useEffect(() => {
    setLoaded(null)
    setError(null)
    setNativeTimings(null)
    setDomTimings(null)
    setFootnote(null)
    if (renderer === 'dom') {
      domMountedAt.current = performance.now()
      return
    }
    let cancelled = false
    const load = async (): Promise<void> => {
      const path = `/v1/bibles/${preset.versionId}/passages/${preset.usfm}?format=html&include_headings=true&include_notes=true`
      const t0 = performance.now()
      const response = await fetchBibleContent({ path })
      const fetchMs = performance.now() - t0
      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`)
      }
      // SAFETY: the passages endpoint returns `{ id, content, reference }` on 200.
      const { content } = JSON.parse(response.body) as { content: string }
      const parsed = parsePassage(content)
      if (cancelled) {
        return
      }
      setNativeTimings({
        fetchMs,
        // The content store answers synchronously-ish; a few ms means it skipped the network.
        cached: fetchMs < 15,
        transformMs: parsed.transformMs,
        walkMs: parsed.walkMs,
        layoutMs: null,
        blocks: parsed.blocks.length,
      })
      setLoaded({ blocks: parsed.blocks, at: performance.now() })
    }
    load().catch((cause: Error) => {
      if (!cancelled) {
        setError(cause.message)
      }
    })
    return () => {
      cancelled = true
    }
  }, [preset, renderer, run, fetchBibleContent])

  const onNativeLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (event.nativeEvent.layout.height <= 0 || loaded === null) {
        return
      }
      const layoutMs = performance.now() - loaded.at
      setNativeTimings((t) => (t === null || t.layoutMs !== null ? t : { ...t, layoutMs }))
    },
    [loaded],
  )

  const onDomLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    if (height <= 1) {
      return
    }
    const elapsed = performance.now() - domMountedAt.current
    setDomTimings((t) => ({ firstMs: t?.firstMs ?? elapsed, settledMs: elapsed, height }))
  }, [])

  const chip = (active: boolean) => [
    styles.chip,
    { borderColor: tokens.border, backgroundColor: active ? tokens.foreground : 'transparent' },
  ]
  const chipText = (active: boolean) => ({ color: active ? tokens.background : tokens.foreground })

  return (
    <View style={[styles.container, { paddingTop: top, backgroundColor: tokens.background }]}>
      <View style={styles.controls}>
        <View style={styles.row}>
          {PRESETS.map((p, i) => (
            <Pressable key={p.label} style={chip(i === presetIndex)} onPress={() => setPresetIndex(i)}>
              <Text style={chipText(i === presetIndex)}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          {(['native', 'dom'] as const).map((r) => (
            <Pressable key={r} style={chip(r === renderer)} onPress={() => setRenderer(r)}>
              <Text style={chipText(r === renderer)}>{r === 'native' ? 'Native' : 'DOM'}</Text>
            </Pressable>
          ))}
          {renderer === 'native' && (
            <Pressable
              style={chip(false)}
              onPress={() => setLabelMode((m) => (m === 'raised' ? 'flat' : 'raised'))}
            >
              <Text style={chipText(false)}>{`Labels: ${labelMode}`}</Text>
            </Pressable>
          )}
          <Pressable style={chip(false)} onPress={() => setRun((n) => n + 1)}>
            <Text style={chipText(false)}>Re-run</Text>
          </Pressable>
        </View>
        <Text style={[styles.timings, { color: tokens.mutedForeground }]}>
          {renderer === 'native'
            ? formatNative(nativeTimings, error)
            : formatDom(domTimings)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {renderer === 'native' ? (
          loaded !== null && (
            <NativePassage
              key={loaded.at}
              blocks={loaded.blocks}
              fontSize={FONT_SIZE}
              serifFamily={serifFamily()}
              rtl={preset.rtl}
              labelMode={labelMode}
              onLayout={onNativeLayout}
              onFootnotePress={(html) => setFootnote(footnoteText(html))}
            />
          )
        ) : (
          <View key={`${preset.label}-${run}`} onLayout={onDomLayout}>
            <BibleTextView reference={preset.usfm} versionId={preset.versionId} fontSize={FONT_SIZE} />
          </View>
        )}
      </ScrollView>

      {footnote !== null && (
        <Pressable
          onPress={() => setFootnote(null)}
          style={[styles.footnote, { backgroundColor: tokens.card, borderColor: tokens.border }]}
        >
          <Text style={{ color: tokens.foreground }}>{footnote}</Text>
        </Pressable>
      )}
    </View>
  )
}

function ms(value: number | null): string {
  return value === null ? '…' : `${value.toFixed(1)}ms`
}

function formatNative(t: NativeTimings | null, error: string | null): string {
  if (error !== null) {
    return `Error: ${error}`
  }
  if (t === null) {
    return 'Loading…'
  }
  return [
    `fetch ${ms(t.fetchMs)}${t.cached ? ' (cache)' : ''}`,
    `transform ${ms(t.transformMs)}`,
    `walk ${ms(t.walkMs)}`,
    `commit→layout ${ms(t.layoutMs)}`,
    `${t.blocks} blocks · ${serifFamily()}`,
  ].join('  ·  ')
}

function formatDom(t: DomTimings | null): string {
  if (t === null) {
    return 'Mounting WebView…'
  }
  return `first size ${ms(t.firstMs)}  ·  last resize ${ms(t.settledMs)}  ·  ${Math.round(t.height)}pt`
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  timings: { fontSize: 12, fontVariant: ['tabular-nums'] },
  scroll: { padding: 16, paddingBottom: 120 },
  footnote: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 100,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
})
