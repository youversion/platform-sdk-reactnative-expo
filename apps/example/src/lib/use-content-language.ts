import { useLocales } from 'expo-localization'

export function useContentLanguage(): string {
  const locales = useLocales()
  const code = locales[0].languageCode
  if (code === null || code === '') return 'en'
  return code
}
