import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { i18n as I18nInstance } from 'i18next'
import { useLocales } from 'expo-localization'

import { SDK_I18N_FALLBACK_LNG } from './constants'
import { createSdkI18n } from './create-sdk-i18n'

type LocaleContextValue = {
  lng: string
  i18n: I18nInstance
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export type LocaleProviderProps = {
  /** When omitted, the SDK reads the device locale via expo-localization. */
  locale?: string
  children: ReactNode
}

export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  const [i18n] = useState(createSdkI18n)

  const locales = useLocales()
  const primary = locales[0]
  const deviceLocale =
    primary?.languageTag ?? primary?.languageCode ?? SDK_I18N_FALLBACK_LNG

  const lng = locale ?? deviceLocale

  useEffect(() => {
    let cancelled = false
    i18n.changeLanguage(lng).catch((err) => {
      if (!cancelled) console.error('[SDK i18n] changeLanguage failed:', err)
    })
    return () => {
      cancelled = true
    }
  }, [lng, i18n])

  const value = useMemo(
    () => ({
      lng,
      i18n,
    }),
    [lng, i18n],
  )

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error(
      'YouVersionProvider is required. Wrap your app with <YouVersionProvider appKey="...">.',
    )
  }
  return context
}
