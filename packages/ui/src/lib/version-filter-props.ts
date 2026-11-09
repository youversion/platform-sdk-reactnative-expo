import type { YouVersionContextValue } from '@youversion/platform-react-native-expo-core'

/** Internal bridge plumbing from core context into web `YouVersionProvider`. Not a public component API. */
export type InternalVersionFilterProps = Pick<
  YouVersionContextValue,
  'permittedVersionIds' | 'excludedVersionIds' | 'permittedLanguageTags'
>

function sameOptionalList<T>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean {
  if (a === b) {
    return true
  }
  if (a === undefined || b === undefined) {
    return false
  }
  if (a.length !== b.length) {
    return false
  }
  return a.every((item, index) => item === b[index])
}

export function sameVersionFilters(
  a: InternalVersionFilterProps,
  b: InternalVersionFilterProps,
): boolean {
  return (
    sameOptionalList(a.permittedVersionIds, b.permittedVersionIds) &&
    sameOptionalList(a.excludedVersionIds, b.excludedVersionIds) &&
    sameOptionalList(a.permittedLanguageTags, b.permittedLanguageTags)
  )
}
