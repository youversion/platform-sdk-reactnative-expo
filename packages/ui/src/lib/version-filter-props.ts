import type { YouVersionContextValue } from '@youversion/platform-react-native-expo-core'

/** Version filter lists forwarded from core context into web YouVersionProvider. */
export type VersionFilterProps = Pick<
  YouVersionContextValue,
  'permittedVersionIds' | 'excludedVersionIds' | 'permittedLanguageTags'
>
