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

type FontLoadScope = {
  isActive: () => boolean
}

async function loadSerifFallbackBestEffort(scope: FontLoadScope): Promise<void> {
  if (!scope.isActive()) {
    return
  }
  try {
    await Font.loadAsync(untitledSerifFallback)
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

function serifFaceIsRegistered(): boolean {
  return Font.isLoaded(fontFamily.serif)
}

const SerifFontReadyContext = createContext(false)

export function SerifFontReadyProvider({
  ready,
  children,
}: {
  ready: boolean
  children: ReactNode
}): ReactNode {
  return createElement(SerifFontReadyContext.Provider, { value: ready }, children)
}

export function useSerifFontReady(): boolean {
  return useContext(SerifFontReadyContext)
}

type BrandFontReadiness = {
  sansReady: boolean
  serifReady: boolean
}

/**
 * Sans readiness opens the provider. Serif readiness flips after one load.
 * That load uses Fonts API TTFs when the request returns them, and Source
 * Serif 4 for every face the API did not return. Native Expo Font cannot
 * unload a face or replace a name that is already loaded, so the fallback
 * is not registered under the Untitled Serif names before this load.
 */
export function useBrandFonts(appKey: string, apiHost?: string): BrandFontReadiness {
  const [sansReady, setSansReady] = useState(sansIsRegistered)
  const [serifReady, setSerifReady] = useState(serifFaceIsRegistered)

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
    const refreshSerifReady = (): void => {
      if (!cancelled) {
        setSerifReady(serifFaceIsRegistered())
      }
    }
    void loadUntitledSerif(appKey, apiHost, scope).finally(refreshSerifReady)
    return () => {
      cancelled = true
    }
  }, [appKey, apiHost])

  return { sansReady, serifReady }
}
