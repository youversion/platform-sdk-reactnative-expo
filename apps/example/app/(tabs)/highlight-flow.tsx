// ⚠️ TEMPORARY DEV HARNESS — delete this file (and its tab trigger in
// `_layout.tsx`) as part of U2 / YPE-3711, which wires the permission flow into
// the real reader.
//
// It exists because the flow shipped by YPE-3709 subtask 3 is complete and
// unit-tested but NOT reachable from the reader: U1 has to forward the verse
// intent across the DOM boundary and U2 has to subscribe it. This screen calls
// `apply()` directly instead, which is the only way to prove the
// `youversionauth://` consent return actually works on device — especially on
// Android, where it resolves through a deep link.
//
// The inline Confirm / Decline panel below stands in for `HighlightConsentSheet`,
// which cannot be written yet: its localized keys (subtask 4) have not synced, and
// `SdkTranslationKey` is generated, so `t('dataExchangeHighlightsQuestion')` does
// not type-check in this repo today. The hook's contract is UI-agnostic, so the
// sheet is a drop-in replacement for this panel when the keys land.
//
// The example provider is deliberately still scopes-only (no `permissions` on
// `auth`), so signing in never grants `highlights`. That makes this screen walk
// the longest path every time — sign-in, then fall through to consent, then apply
// — which is exactly the path worth verifying.
import {
  HIGHLIGHT_COLORS,
  useHighlightPermissionFlow,
  useYVAuth,
  type HighlightWriteOutcome,
} from '@youversion/platform-react-native-expo-core'
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native'

const VERSION_ID = 111 // NIV
const BOOK = 'JHN'
const CHAPTER = '3'
const VERSES = [16, 17, 18]

export default function HighlightFlowScreen() {
  const isDark = useColorScheme() === 'dark'
  const c = isDark ? dark : light

  const { isAuthenticated, isLoading, userInfo, grantedPermissions, signOut } = useYVAuth()
  const flow = useHighlightPermissionFlow({
    versionId: VERSION_ID,
    book: BOOK,
    chapter: CHAPTER,
  })

  const [selected, setSelected] = useState<number[]>([16])
  const [lastOutcome, setLastOutcome] = useState<HighlightWriteOutcome | null>(null)
  const [inFlight, setInFlight] = useState(0)
  const [lastSettleMs, setLastSettleMs] = useState<number | null>(null)

  const toggleVerse = (verse: number) => {
    setSelected((prev) =>
      prev.includes(verse)
        ? prev.filter((v) => v !== verse)
        : [...prev, verse].sort((a, b) => a - b),
    )
  }

  // Deliberately does NOT lock the controls until the write settles. The paint
  // is optimistic and lands on tap; the network round-trip behind it is the
  // slow part, and gating the swatches on it would hide the one behaviour this
  // harness exists to demonstrate. `useHighlights` supports concurrent writes,
  // so overlapping taps are a supported case rather than one to prevent.
  //
  // `lastSettleMs` is the round-trip, measured from the tap. Compare it against
  // how fast the Highlights section below repaints: the gap between the two is
  // the optimistic window.
  //
  // `useCallback` is not here for memoization. `Date.now()` is impure, and the
  // React Compiler's purity rule rejects it in a function declared bare in the
  // component body — it cannot see that this one only ever runs from an `onPress`.
  const run = useCallback(async (action: () => Promise<HighlightWriteOutcome>) => {
    const startedAt = Date.now()
    setInFlight((count) => count + 1)
    try {
      setLastOutcome(await action())
    } finally {
      setLastSettleMs(Date.now() - startedAt)
      setInFlight((count) => count - 1)
    }
  }, [])

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={[styles.banner, { color: c.warn, borderColor: c.warn }]}>
        Temporary dev harness — removed by U2 (YPE-3711)
      </Text>

      <Section title="Auth" color={c}>
        <Row
          label="state"
          value={isLoading ? 'loading' : isAuthenticated ? 'signed in' : 'signed out'}
          color={c}
        />
        <Row label="user" value={userInfo?.name ?? userInfo?.id ?? '—'} color={c} />
        <Row label="granted" value={formatGrant(grantedPermissions)} color={c} />
        {isAuthenticated ? (
          <Pressable
            style={[styles.button, { borderColor: c.border }]}
            onPress={() => void signOut()}
          >
            <Text style={{ color: c.fg }}>Sign out (reset the flow)</Text>
          </Pressable>
        ) : null}
      </Section>

      <Section title={`Verses — ${BOOK}.${CHAPTER}`} color={c}>
        <View style={styles.row}>
          {VERSES.map((verse) => {
            const on = selected.includes(verse)
            return (
              <Pressable
                key={verse}
                style={[
                  styles.chip,
                  { borderColor: c.border, backgroundColor: on ? c.chipOn : 'transparent' },
                ]}
                onPress={() => toggleVerse(verse)}
              >
                <Text style={{ color: c.fg }}>v{verse}</Text>
              </Pressable>
            )
          })}
        </View>
      </Section>

      <Section title="Tap a color to apply" color={c}>
        <View style={styles.row}>
          {HIGHLIGHT_COLORS.map((color) => (
            <Pressable
              key={color}
              disabled={selected.length === 0}
              style={[
                styles.swatch,
                {
                  backgroundColor: `#${color}`,
                  borderColor: c.border,
                  opacity: selected.length === 0 ? 0.4 : 1,
                },
              ]}
              onPress={() => void run(() => flow.apply(color, selected))}
            />
          ))}
        </View>
        <View style={styles.row}>
          {HIGHLIGHT_COLORS.map((color) => (
            <Pressable
              key={color}
              disabled={selected.length === 0}
              style={[
                styles.chip,
                { borderColor: c.border, opacity: selected.length === 0 ? 0.4 : 1 },
              ]}
              onPress={() => void run(() => flow.highlights.remove(color, selected))}
            />
          ))}
        </View>
        <Text style={[styles.hint, { color: c.muted }]}>
          Top row applies (guarded by the flow); bottom row removes (passes straight through).
        </Text>
      </Section>

      {/* Stand-in for HighlightConsentSheet — see the header comment. */}
      {flow.isConfirming ? (
        <View style={[styles.consent, { borderColor: c.warn }]}>
          <Text style={[styles.consentTitle, { color: c.fg }]}>
            Allow this app to save highlights with YouVersion?
          </Text>
          <Text style={{ color: c.muted }}>
            YouVersion will ask you to grant access before highlights can be saved.
          </Text>
          <View style={styles.row}>
            <Pressable style={[styles.button, { borderColor: c.border }]} onPress={flow.confirm}>
              <Text style={{ color: c.fg }}>Continue</Text>
            </Pressable>
            <Pressable style={[styles.button, { borderColor: c.border }]} onPress={flow.decline}>
              <Text style={{ color: c.fg }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Section title="Flow" color={c}>
        <Row label="isConfirming" value={String(flow.isConfirming)} color={c} />
        <Row
          label="flowError"
          value={flow.flowError ? `${flow.flowError.reason}: ${flow.flowError.message}` : '—'}
          color={c}
        />
        <Row label="writes in flight" value={String(inFlight)} color={c} />
        <Row
          label="last settle"
          value={lastSettleMs === null ? '—' : `${lastSettleMs}ms (tap → promise resolved)`}
          color={c}
        />
        <Row
          label="last outcome"
          value={lastOutcome === null ? '—' : JSON.stringify(lastOutcome)}
          color={c}
        />
      </Section>

      <Section title="Highlights" color={c}>
        <Row label="isRefreshing" value={String(flow.highlights.isRefreshing)} color={c} />
        <Row label="fetch error" value={flow.highlights.error?.reason ?? '—'} color={c} />
        {flow.highlights.highlights.length === 0 ? (
          <Text style={{ color: c.muted }}>none</Text>
        ) : (
          flow.highlights.highlights.map((h) => (
            <Row key={h.passage_id} label={h.passage_id} value={`#${h.color}`} color={c} />
          ))
        )}
      </Section>
    </ScrollView>
  )
}

function formatGrant(granted: readonly string[] | null): string {
  if (granted === null) {
    return 'null (nothing requested / unknown)'
  }
  return granted.length === 0 ? '[] (asked and denied)' : granted.join(', ')
}

type Palette = typeof light

function Section({
  title,
  color,
  children,
}: {
  title: string
  color: Palette
  children: React.ReactNode
}) {
  return (
    <View style={[styles.section, { borderColor: color.border }]}>
      <Text style={[styles.sectionTitle, { color: color.muted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  )
}

function Row({ label, value, color }: { label: string; value: string; color: Palette }) {
  return (
    <View style={styles.kv}>
      <Text style={[styles.key, { color: color.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: color.fg }]} selectable>
        {value}
      </Text>
    </View>
  )
}

const light = {
  bg: '#ffffff',
  fg: '#000000',
  muted: '#6b6b6b',
  border: '#d8d8d8',
  chipOn: '#e6e6e6',
  warn: '#a35200',
}
const dark = {
  bg: '#000000',
  fg: '#ffffff',
  muted: '#9b9b9b',
  border: '#333333',
  chipOn: '#2a2a2a',
  warn: '#ffb964',
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  banner: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 44,
  },
  swatch: { width: 44, height: 32, borderRadius: 8, borderWidth: 1 },
  button: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 },
  hint: { fontSize: 12 },
  consent: { borderWidth: 2, borderRadius: 10, padding: 12, gap: 10 },
  consentTitle: { fontSize: 16, fontWeight: '600' },
  kv: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  key: { fontSize: 13, width: 104 },
  value: { fontSize: 13, flex: 1 },
})
