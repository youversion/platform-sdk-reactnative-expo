import en from './locales/en.json'

/** Derived from the canonical English locale file — add keys in en.json only. */
export type SdkTranslationResources = typeof en

export type SdkTranslationKey = keyof SdkTranslationResources
