import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from '@expo-google-fonts/inter'
import {
  SourceSerif4_400Regular,
  SourceSerif4_400Regular_Italic,
  SourceSerif4_500Medium,
  SourceSerif4_500Medium_Italic,
  SourceSerif4_700Bold,
  SourceSerif4_700Bold_Italic,
} from '@expo-google-fonts/source-serif-4'
import * as Font from 'expo-font'
import { useEffect } from 'react'

import { buildFontMap, fetchUntitledSerifFont, pickTtfSources } from './fonts'

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

async function loadBrandFonts(appKey: string, apiHost?: string): Promise<void> {
  try {
    await Font.loadAsync(bundledSans)
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

/**
 * Starts Inter and Untitled Serif in the background.
 * Source Serif 4 is registered only as the Untitled Serif fallback.
 * Does not report ready/error. Children still render while fonts load.
 */
export function useBrandFonts(appKey: string, apiHost?: string): void {
  useEffect(() => {
    void loadBrandFonts(appKey, apiHost)
  }, [appKey, apiHost])
}
