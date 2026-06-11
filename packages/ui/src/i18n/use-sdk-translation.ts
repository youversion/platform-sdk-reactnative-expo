import { useTranslation } from 'react-i18next'

import { useLocale } from './locale-context'

export function useSdkTranslation() {
  const { i18n } = useLocale()
  return useTranslation(undefined, { i18n })
}
