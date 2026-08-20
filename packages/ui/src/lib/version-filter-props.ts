import type { YouVersionContextValue } from '@youversion/platform-react-native-expo-core'

/** Internal bridge plumbing from core context into web `YouVersionProvider`. Not a public component API. */
export type InternalVersionFilterProps = Pick<
  YouVersionContextValue,
  'permittedVersionIds' | 'excludedVersionIds' | 'permittedLanguageTags'
>
