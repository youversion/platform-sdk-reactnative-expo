import type { ComponentType } from 'react'

export type ImplKey =
  | 'BibleAppLogo'
  | 'BibleCardDom'
  | 'BibleChapterPickerSheet'
  | 'BibleReaderDom'
  | 'BibleReaderSettings'
  | 'BibleReaderSettingsSheet'
  | 'BibleTextViewDom'
  | 'BibleVerseActionSheet'
  | 'BibleVersionPickerContent'
  | 'BibleVersionPickerSheet'
  | 'ChapterPickerContent'
  | 'FootnoteContent'
  | 'HighlightConsentSheet'
  | 'NativeSheet'
  | 'SignInWithYouVersionSheet'
  | 'VerseOfTheDayDom'

// Heterogeneous registry: each key has its own props. Callers pass the matching key.
export type ImplComponent = ComponentType<any>

const defaults = new Map<ImplKey, ImplComponent>()
const overrides = new Map<ImplKey, ImplComponent>()

export function registerDefault(key: ImplKey, impl: ImplComponent): void {
  defaults.set(key, impl)
}

export function getImpl(key: ImplKey): ImplComponent {
  const impl = overrides.get(key) ?? defaults.get(key)
  if (!impl) {
    throw new Error(`No implementation registered for ${key}`)
  }
  return impl
}

export function setImpl(key: ImplKey, impl: ImplComponent): void {
  overrides.set(key, impl)
}

export function resetImpls(): void {
  overrides.clear()
}
