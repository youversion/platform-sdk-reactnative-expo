import {
  biblePassageAnchorFromPassageId,
  useUnifiedSearch,
  type SearchApiError,
} from '@youversion/platform-react-native-expo-core'
import { useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type FieldMode = 'images' | 'images-and-verses'

type SubmittedSearch = {
  query: string
  versionId: string
  language: string
  fieldMode: FieldMode
}

const INITIAL_SEARCH: SubmittedSearch = {
  query: 'psalm 23',
  versionId: '3034',
  language: 'en',
  fieldMode: 'images-and-verses',
}

export default function UnifiedSearchScreen() {
  const { top, bottom } = useSafeAreaInsets()
  const isDark = useColorScheme() === 'dark'
  const theme = isDark ? darkTheme : lightTheme

  const [query, setQuery] = useState(INITIAL_SEARCH.query)
  const [versionId, setVersionId] = useState(INITIAL_SEARCH.versionId)
  const [language, setLanguage] = useState(INITIAL_SEARCH.language)
  const [fieldMode, setFieldMode] = useState<FieldMode>(INITIAL_SEARCH.fieldMode)
  const [submitted, setSubmitted] = useState(INITIAL_SEARCH)

  const parsedVersion = Number(submitted.versionId)
  const versionReady = Number.isInteger(parsedVersion) && parsedVersion > 0
  const inputReady =
    submitted.query.length > 0 && versionReady && submitted.language.length > 0
  const fields = fieldsForMode(submitted.fieldMode)
  const bibleId = versionReady ? parsedVersion : 1
  const languageRanges = submitted.language.length > 0 ? submitted.language : 'en'

  const search = useUnifiedSearch(
    {
      query: submitted.query,
      bibleId,
      languageRanges,
      fields,
    },
    { enabled: inputReady },
  )

  function searchFromFields() {
    const next: SubmittedSearch = {
      query: query.trim(),
      versionId: versionId.trim(),
      language: language.trim(),
      fieldMode,
    }
    if (
      next.query === submitted.query &&
      next.versionId === submitted.versionId &&
      next.language === submitted.language &&
      next.fieldMode === submitted.fieldMode
    ) {
      search.refetch()
      return
    }
    setSubmitted(next)
  }

  let formError: string | null = null
  if (submitted.query.length === 0) {
    formError = 'Enter a query.'
  } else if (!versionReady) {
    formError = 'Version id must be a positive whole number.'
  } else if (submitted.language.length === 0) {
    formError = 'Enter a language.'
  }

  const data = search.data

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.content, { paddingTop: top + 12, paddingBottom: bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: theme.fg }]}>Unified search</Text>
      <Text style={[styles.hint, { color: theme.muted }]}>
        Uses useUnifiedSearch. Image hits are an id and a passage.
      </Text>

      <Text style={[styles.label, { color: theme.muted }]}>Query</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        placeholder="psalm 23"
        placeholderTextColor={theme.muted}
        style={[styles.input, inputColors(theme)]}
      />

      <Text style={[styles.label, { color: theme.muted }]}>Bible version id</Text>
      <TextInput
        value={versionId}
        onChangeText={setVersionId}
        keyboardType="number-pad"
        placeholder="3034"
        placeholderTextColor={theme.muted}
        style={[styles.input, inputColors(theme)]}
      />

      <Text style={[styles.label, { color: theme.muted }]}>Language</Text>
      <TextInput
        value={language}
        onChangeText={setLanguage}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="en"
        placeholderTextColor={theme.muted}
        style={[styles.input, inputColors(theme)]}
      />

      <Text style={[styles.label, { color: theme.muted }]}>Fields</Text>
      <View style={styles.modes}>
        <ModeButton
          label="Images"
          selected={fieldMode === 'images'}
          theme={theme}
          onPress={() => setFieldMode('images')}
        />
        <ModeButton
          label="Images + verses"
          selected={fieldMode === 'images-and-verses'}
          theme={theme}
          onPress={() => setFieldMode('images-and-verses')}
        />
      </View>

      <Pressable
        onPress={searchFromFields}
        style={[styles.button, { backgroundColor: theme.fg }]}
      >
        <Text style={[styles.buttonLabel, { color: theme.bg }]}>
          {search.loading ? 'Searching…' : 'Search'}
        </Text>
      </Pressable>

      {formError !== null ? <Text style={styles.error}>{formError}</Text> : null}
      {search.error !== null ? (
        <Text style={styles.error}>{errorLabel(search.error)}</Text>
      ) : null}
      {search.loading ? (
        <Text style={[styles.hint, { color: theme.muted }]}>Loading…</Text>
      ) : null}

      {data !== null ? (
        <View style={styles.results}>
          <Text style={[styles.hint, { color: theme.muted }]}>
            Intent {data.userIntent ?? 'none'}
          </Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            Did you mean {data.didYouMean.length > 0 ? data.didYouMean.join(', ') : 'none'}
          </Text>
          <Text style={[styles.hint, { color: theme.muted }]}>
            Search instead {data.searchInsteadFor ?? 'none'}
          </Text>

          <Text style={[styles.section, { color: theme.fg }]}>Images ({data.images.length})</Text>
          {data.images.length === 0 ? (
            <Text style={[styles.hint, { color: theme.muted }]}>No image hits.</Text>
          ) : (
            data.images.map((image) => (
              <View key={image.id} style={styles.hitBlock}>
                <Text style={[styles.hitTitle, { color: theme.fg }]}>Image {image.id}</Text>
                <PassageLines passageId={image.passageId} versionId={bibleId} theme={theme} />
              </View>
            ))
          )}

          <Text style={[styles.section, { color: theme.fg }]}>Verses ({data.verses.length})</Text>
          {data.verses.length === 0 ? (
            <Text style={[styles.hint, { color: theme.muted }]}>No verse hits.</Text>
          ) : (
            data.verses.map((verse) => (
              <PassageLines
                key={verse.id}
                passageId={verse.id}
                versionId={bibleId}
                theme={theme}
              />
            ))
          )}

          <Text style={[styles.section, { color: theme.fg }]}>Topics ({data.topics.length})</Text>
          {data.topics.length === 0 ? (
            <Text style={[styles.hint, { color: theme.muted }]}>No topic hits.</Text>
          ) : (
            data.topics.map((topic) => (
              <View key={`${topic.id ?? 'none'}-${topic.text}`} style={styles.hitBlock}>
                <Text style={[styles.hitTitle, { color: theme.fg }]}>{topic.text}</Text>
                <Text style={[styles.hit, { color: theme.muted }]}>Id {topic.id ?? 'none'}</Text>
                <Text style={[styles.hit, { color: theme.muted }]}>
                  Subtopics {topic.subtopics.length > 0 ? topic.subtopics.join(', ') : 'none'}
                </Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </ScrollView>
  )
}

function PassageLines({
  passageId,
  versionId,
  theme,
}: {
  passageId: string
  versionId: number
  theme: typeof lightTheme
}) {
  const anchor = biblePassageAnchorFromPassageId(passageId, versionId)
  if (anchor === null) {
    return <Text style={[styles.hit, { color: theme.fg }]}>{passageId}</Text>
  }
  const bookName = BOOK_NAMES[anchor.bookId] ?? anchor.bookId
  let title = `${bookName} ${anchor.chapter}`
  if (anchor.verse !== undefined) {
    title = `${title}:${anchor.verse}`
  }
  const rangeEnd = rangeEndOf(passageId)
  if (rangeEnd !== null && anchor.verse !== undefined && rangeEnd !== anchor.verse) {
    title = `${title}-${rangeEnd}`
  }
  let verseLine = 'Verse none (whole chapter)'
  if (anchor.verse !== undefined) {
    verseLine = `Verse ${anchor.verse}`
  }
  return (
    <View style={styles.hitBlock}>
      <Text style={[styles.hitTitle, { color: theme.fg }]}>{title}</Text>
      <Text style={[styles.hit, { color: theme.muted }]}>Book {anchor.bookId}</Text>
      <Text style={[styles.hit, { color: theme.muted }]}>Chapter {anchor.chapter}</Text>
      <Text style={[styles.hit, { color: theme.muted }]}>{verseLine}</Text>
      <Text style={[styles.hit, { color: theme.muted }]}>Passage {passageId}</Text>
    </View>
  )
}

function rangeEndOf(passageId: string): number | null {
  const parts = passageId.split('.')
  const versePart = parts[2]
  if (versePart === undefined) {
    return null
  }
  const end = versePart.split('-')[1]
  if (end === undefined || !/^\d+$/.test(end)) {
    return null
  }
  return Number(end)
}

function ModeButton({
  label,
  selected,
  theme,
  onPress,
}: {
  label: string
  selected: boolean
  theme: typeof lightTheme
  onPress: () => void
}) {
  const backgroundColor = selected ? theme.fg : theme.field
  const color = selected ? theme.bg : theme.fg
  return (
    <Pressable
      onPress={onPress}
      style={[styles.mode, { backgroundColor, borderColor: theme.border }]}
    >
      <Text style={[styles.modeLabel, { color }]}>{label}</Text>
    </Pressable>
  )
}

function fieldsForMode(mode: FieldMode): Array<'images' | 'verses'> {
  if (mode === 'images') {
    return ['images']
  }
  return ['images', 'verses']
}

function inputColors(theme: typeof lightTheme) {
  return {
    color: theme.fg,
    borderColor: theme.border,
    backgroundColor: theme.field,
  }
}

function errorLabel(error: SearchApiError): string {
  if (error.kind === 'auth' || error.kind === 'not-found') {
    return `${error.kind} (${error.status}): ${error.message}`
  }
  if (error.kind === 'transient' && error.status !== undefined) {
    return `${error.kind} (${error.status}): ${error.message}`
  }
  return `${error.kind}: ${error.message}`
}

const BOOK_NAMES: Record<string, string> = {
  GEN: 'Genesis',
  EXO: 'Exodus',
  LEV: 'Leviticus',
  NUM: 'Numbers',
  DEU: 'Deuteronomy',
  JOS: 'Joshua',
  JDG: 'Judges',
  RUT: 'Ruth',
  '1SA': '1 Samuel',
  '2SA': '2 Samuel',
  '1KI': '1 Kings',
  '2KI': '2 Kings',
  '1CH': '1 Chronicles',
  '2CH': '2 Chronicles',
  EZR: 'Ezra',
  NEH: 'Nehemiah',
  EST: 'Esther',
  JOB: 'Job',
  PSA: 'Psalm',
  PRO: 'Proverbs',
  ECC: 'Ecclesiastes',
  SNG: 'Song of Solomon',
  ISA: 'Isaiah',
  JER: 'Jeremiah',
  LAM: 'Lamentations',
  EZK: 'Ezekiel',
  DAN: 'Daniel',
  HOS: 'Hosea',
  JOL: 'Joel',
  AMO: 'Amos',
  OBA: 'Obadiah',
  JON: 'Jonah',
  MIC: 'Micah',
  NAM: 'Nahum',
  HAB: 'Habakkuk',
  ZEP: 'Zephaniah',
  HAG: 'Haggai',
  ZEC: 'Zechariah',
  MAL: 'Malachi',
  MAT: 'Matthew',
  MRK: 'Mark',
  LUK: 'Luke',
  JHN: 'John',
  ACT: 'Acts',
  ROM: 'Romans',
  '1CO': '1 Corinthians',
  '2CO': '2 Corinthians',
  GAL: 'Galatians',
  EPH: 'Ephesians',
  PHP: 'Philippians',
  COL: 'Colossians',
  '1TH': '1 Thessalonians',
  '2TH': '2 Thessalonians',
  '1TI': '1 Timothy',
  '2TI': '2 Timothy',
  TIT: 'Titus',
  PHM: 'Philemon',
  HEB: 'Hebrews',
  JAS: 'James',
  '1PE': '1 Peter',
  '2PE': '2 Peter',
  '1JN': '1 John',
  '2JN': '2 John',
  '3JN': '3 John',
  JUD: 'Jude',
  REV: 'Revelation',
}

const lightTheme = {
  bg: '#ffffff',
  fg: '#121212',
  muted: '#6b6b6b',
  border: '#e4e4e4',
  field: '#f6f6f6',
}

const darkTheme = {
  bg: '#000000',
  fg: '#ffffff',
  muted: '#9b9b9b',
  border: '#2c2c2c',
  field: '#141414',
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  hint: {
    fontSize: 15,
    lineHeight: 20,
  },
  label: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modes: {
    flexDirection: 'row',
    gap: 8,
  },
  mode: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  button: {
    marginTop: 8,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#b42318',
    fontSize: 15,
    lineHeight: 20,
  },
  results: {
    marginTop: 12,
    gap: 6,
  },
  section: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  hit: {
    fontSize: 14,
  },
  hitTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  hitBlock: {
    gap: 2,
    marginBottom: 8,
  },
})
