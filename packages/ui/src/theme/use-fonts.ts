import { Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter'
import {
  SourceSerif4_400Regular,
  SourceSerif4_400Regular_Italic,
  SourceSerif4_500Medium,
  SourceSerif4_500Medium_Italic,
  SourceSerif4_700Bold,
  SourceSerif4_700Bold_Italic,
} from '@expo-google-fonts/source-serif-4'
import * as Font from 'expo-font'
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react'

import { buildFontMap, fetchUntitledSerifFont, pickTtfSources, type BrandFontUriMap } from './fonts'
import { fontFamily } from './scales'

export const bundledSans = {
  Inter: Inter_400Regular,
  Inter_medium: Inter_500Medium,
  Inter_bold: Inter_700Bold,
}

export const untitledSerifFallback = {
  'Untitled Serif': SourceSerif4_400Regular,
  'Untitled Serif_italic': SourceSerif4_400Regular_Italic,
  'Untitled Serif_medium': SourceSerif4_500Medium,
  'Untitled Serif_medium_italic': SourceSerif4_500Medium_Italic,
  'Untitled Serif_bold': SourceSerif4_700Bold,
  'Untitled Serif_bold_italic': SourceSerif4_700Bold_Italic,
}

const sourceSerifFamily = 'Source Serif 4'

type SerifFamily = typeof fontFamily.serif | typeof sourceSerifFamily

export const bundledSerif = {
  'Source Serif 4': SourceSerif4_400Regular,
  'Source Serif 4_italic': SourceSerif4_400Regular_Italic,
  'Source Serif 4_medium': SourceSerif4_500Medium,
  'Source Serif 4_medium_italic': SourceSerif4_500Medium_Italic,
  'Source Serif 4_bold': SourceSerif4_700Bold,
  'Source Serif 4_bold_italic': SourceSerif4_700Bold_Italic,
}

type FontLoadScope = {
  isActive: () => boolean
}

async function loadSerifFallbackBestEffort(scope: FontLoadScope): Promise<void> {
  if (!scope.isActive()) {
    return
  }
  try {
    await Font.loadAsync(bundledSerif)
  } catch (cause) {
    console.error('[YouVersion SDK] serif fallback failed to load:', cause)
  }
}

async function loadSerifWithApiTtfs(apiTtfMap: BrandFontUriMap, scope: FontLoadScope): Promise<void> {
  if (Object.keys(apiTtfMap).length === 0 || !scope.isActive()) {
    return
  }
  await Font.loadAsync({
    ...untitledSerifFallback,
    ...apiTtfMap,
  })
}

async function loadUntitledSerif(
  appKey: string,
  apiHost: string | undefined,
  scope: FontLoadScope,
): Promise<void> {
  if (!appKey.trim()) {
    await loadSerifFallbackBestEffort(scope)
    return
  }

  try {
    const font = await fetchUntitledSerifFont({ appKey, apiHost })
    if (!scope.isActive()) {
      return
    }
    let untitledSerifFaces: ReturnType<typeof pickTtfSources> = []
    if (font) {
      untitledSerifFaces = pickTtfSources(font)
    }
    const apiTtfMap = buildFontMap(untitledSerifFaces)
    if (Object.keys(apiTtfMap).length > 0) {
      await loadSerifWithApiTtfs(apiTtfMap, scope)
      return
    }
    await loadSerifFallbackBestEffort(scope)
  } catch (cause) {
    if (!scope.isActive()) {
      return
    }
    const nextError = cause instanceof Error ? cause : new Error(String(cause))
    console.error('[YouVersion SDK] brand fonts failed to load:', nextError)
    await loadSerifFallbackBestEffort(scope)
  }
}

function sansIsRegistered(): boolean {
  return Object.keys(bundledSans).every((face) => Font.isLoaded(face))
}

function registeredSerifFamily(): SerifFamily {
  if (!Font.isLoaded(fontFamily.serif) && Font.isLoaded(sourceSerifFamily)) {
    return sourceSerifFamily
  }
  return fontFamily.serif
}

const SerifFamilyContext = createContext<SerifFamily>(fontFamily.serif)

export function SerifFamilyProvider({
  family,
  children,
}: {
  family: SerifFamily
  children: ReactNode
}): ReactNode {
  return createElement(SerifFamilyContext.Provider, { value: family }, children)
}

/** Native serif text names this family; pass it to `fontMapKey` for a weight or style. */
export function useSerifFamily(): SerifFamily {
  return useContext(SerifFamilyContext)
}

type BrandFontReadiness = {
  sansReady: boolean
  serifFamily: SerifFamily
}

/**
 * Sans readiness opens the provider. Each serif load registers one family.
 * Fonts API TTFs register under the Untitled Serif names, with Source Serif 4
 * for every face the API did not return. When the API returns no TTFs or the
 * request fails, Source Serif 4 registers under its own names. Native Expo
 * Font cannot unload a face or replace a loaded name, so keeping the fallback
 * off the Untitled Serif names lets a later load, after an `appKey` or
 * `apiHost` change, still register the API faces.
 */
export function useBrandFonts(appKey: string, apiHost?: string): BrandFontReadiness {
  const [sansReady, setSansReady] = useState(sansIsRegistered)
  const [serifFamily, setSerifFamily] = useState(registeredSerifFamily)

  useEffect(() => {
    let cancelled = false
    Font.loadAsync(bundledSans).then(
      () => {
        if (!cancelled) {
          setSansReady(true)
        }
      },
      (cause: unknown) => {
        console.error('[YouVersion SDK] sans faces failed to load:', cause)
        if (!cancelled) {
          setSansReady(true)
        }
      },
    )
    const scope: FontLoadScope = { isActive: () => !cancelled }
    const refreshSerifFamily = (): void => {
      if (!cancelled) {
        setSerifFamily(registeredSerifFamily())
      }
    }
    void loadUntitledSerif(appKey, apiHost, scope).finally(refreshSerifFamily)
    return () => {
      cancelled = true
    }
  }, [appKey, apiHost])

  return { sansReady, serifFamily }
}
