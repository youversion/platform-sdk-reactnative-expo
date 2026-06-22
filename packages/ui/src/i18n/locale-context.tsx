import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { i18n as I18nInstance } from 'i18next'
import { useLocales } from 'expo-localization'

import { detectDeviceLocale } from './detect-device-locale'
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
  const deviceLocale = detectDeviceLocale(locales[0])

  const lng = locale ?? deviceLocale

  // Track a version counter so stale changeLanguage resolutions (from a
  // previous lng value) don't overwrite the current language.
  const lngVersionRef = useRef(0)
  useEffect(() => {
    const version = ++lngVersionRef.current
    i18n.changeLanguage(lng).catch((err) => {
      if (lngVersionRef.current === version) {
        console.error('[SDK i18n] changeLanguage failed:', err)
      }
    })
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
