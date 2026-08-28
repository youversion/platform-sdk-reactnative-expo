import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
} from '@expo-google-fonts/inter'
import {
  SourceSerif4_400Regular,
  SourceSerif4_500Medium,
  SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4'
import * as Font from 'expo-font'
import { useEffect } from 'react'

import { buildFontMap, fetchUntitledSerifFont, pickTtfSources } from './fonts'

const bundledSansAndFallbackSerif = {
  Inter: Inter_400Regular,
  Inter_medium: Inter_500Medium,
  Inter_bold: Inter_700Bold,
  'Source Serif 4': SourceSerif4_400Regular,
  'Source Serif 4_medium': SourceSerif4_500Medium,
  'Source Serif 4_bold': SourceSerif4_700Bold,
}

const untitledSerifFallback = {
  'Untitled Serif': SourceSerif4_400Regular,
  'Untitled Serif_medium': SourceSerif4_500Medium,
  'Untitled Serif_bold': SourceSerif4_700Bold,
}

let lastBrandFontError: Error | null = null

export type BrandFontsState = {
  loaded: boolean
  error: Error | null
}

async function loadBrandFonts(appKey: string, apiHost?: string): Promise<void> {
  try {
    await Font.loadAsync(bundledSansAndFallbackSerif)
    const font = await fetchUntitledSerifFont({ appKey, apiHost })
    let untitledSerifFaces: ReturnType<typeof pickTtfSources> = []
    if (font) {
      untitledSerifFaces = pickTtfSources(font)
    }
    if (untitledSerifFaces.length > 0) {
      await Font.loadAsync(buildFontMap(untitledSerifFaces))
    } else {
      await Font.loadAsync(untitledSerifFallback)
    }
    lastBrandFontError = null
  } catch (cause) {
    const nextError = cause instanceof Error ? cause : new Error(String(cause))
    lastBrandFontError = nextError
    console.error('[YouVersion SDK] brand fonts failed to load:', nextError)
    try {
      await Font.loadAsync(untitledSerifFallback)
    } catch {
      // Fallback faces are best-effort; the first error is what we report.
    }
  }
}

/**
 * Loads Inter, Source Serif 4, and Untitled Serif in the background.
 */
export function useBrandFonts(appKey: string, apiHost?: string): BrandFontsState {
  useEffect(() => {
    void loadBrandFonts(appKey, apiHost)
  }, [appKey, apiHost])

  const isUntitledSerifLoaded = Font.isLoaded('Untitled Serif') || Font.isLoaded('Source Serif 4')
  return {
    loaded: Font.isLoaded('Inter') && isUntitledSerifLoaded,
    error: lastBrandFontError,
  }
}
