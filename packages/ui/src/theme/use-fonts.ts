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

import { buildFontMap, fetchUntitledSerifFont, pickTtfSources } from './fonts'
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

async function loadUntitledSerif(appKey: string, apiHost?: string): Promise<void> {
  try {
    const font = await fetchUntitledSerifFont({ appKey, apiHost })
    let untitledSerifFaces: ReturnType<typeof pickTtfSources> = []
    if (font) {
      untitledSerifFaces = pickTtfSources(font)
    }
    await Font.loadAsync({
      ...untitledSerifFallback,
      ...buildFontMap(untitledSerifFaces),
    })
  } catch (cause) {
    const nextError = cause instanceof Error ? cause : new Error(String(cause))
    console.error('[YouVersion SDK] brand fonts failed to load:', nextError)
    try {
      await Font.loadAsync(untitledSerifFallback)
    } catch {
      // Fallback faces are best-effort; the first error is what we report.
    }
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
 * Sans readiness opens the provider. Serif readiness tracks when the Untitled
 * Serif face is registered (bundled Source Serif 4 first, then the Fonts API
 * upgrade in the background). Settings keep the serif choice visible while the
 * remote request is pending.
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
    void Font.loadAsync(untitledSerifFallback).finally(() => {
      if (!cancelled) {
        setSerifReady(serifFaceIsRegistered())
      }
    })
    void loadUntitledSerif(appKey, apiHost).finally(() => {
      if (!cancelled) {
        setSerifReady(serifFaceIsRegistered())
      }
    })
    return () => {
      cancelled = true
    }
  }, [appKey, apiHost])

  return { sansReady, serifReady }
}
