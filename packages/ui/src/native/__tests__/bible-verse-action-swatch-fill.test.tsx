/**
 * Native verse-action dots mix stored hex against SHEET_SURFACE via mixSrgb
 * (YPE-5059). Light is identity. Dark is p = 0.20 against #121212.
 */
import { mixSrgb } from '@youversion/platform-react-native-expo-core'
import { render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { SHEET_SURFACE } from '../../lib/native-sheet-theme'
import type { VerseActionSwatch } from '../../lib/verse-action-swatches'
import { defaultHookOverrides } from '../../test-utils/default-hook-overrides'
import { resetImpls } from '../../test-utils/install-test-impls'
import { BibleVerseActionSheet } from '../bible-verse-action-sheet'
import { YouVersionProvider } from '../youversion-provider'

const YELLOW = 'ffec5b' as const
const LEFTOVER_YELLOW = 'fffe00'
const DARK_YELLOW_FILL = '#413e21'
const DARK_LEFTOVER_FILL = '#41410e'

function SheetHarness({
  theme,
  swatches,
}: {
  theme: 'light' | 'dark'
  swatches: VerseActionSwatch[]
}): ReactNode {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <YouVersionProvider appKey="test-key" theme={theme} hookOverrides={defaultHookOverrides}>
        <View>
          <BibleVerseActionSheet
            isOpen={true}
            reference="John 1:1"
            swatches={swatches}
            onSwatchPress={() => undefined}
            onCopyPress={() => undefined}
            onSharePress={() => undefined}
            onClose={() => undefined}
            theme={theme}
          />
        </View>
      </YouVersionProvider>
    </SafeAreaProvider>
  )
}

function swatchFill(state: 'apply' | 'remove', color: string): string | undefined {
  return StyleSheet.flatten(
    screen.getByTestId(`bible-verse-action-swatch-${state}-${color}`).props.style,
  ).backgroundColor
}

describe('BibleVerseActionSheet swatch fill', () => {
  beforeEach(() => {
    resetImpls()
  })

  it('paints light dots as the stored hex (mixSrgb identity against SHEET_SURFACE)', () => {
    render(<SheetHarness theme="light" swatches={[{ color: YELLOW, state: 'apply' }]} />)

    expect(swatchFill('apply', YELLOW)).toBe('#ffec5b')
    expect(swatchFill('apply', YELLOW)).toBe(`#${mixSrgb(YELLOW, SHEET_SURFACE.light, 1)}`)
  })

  it('paints dark dots at p = 0.20 against SHEET_SURFACE dark', () => {
    render(<SheetHarness theme="dark" swatches={[{ color: YELLOW, state: 'apply' }]} />)

    expect(swatchFill('apply', YELLOW)).toBe(DARK_YELLOW_FILL)
    expect(swatchFill('apply', YELLOW)).toBe(`#${mixSrgb(YELLOW, SHEET_SURFACE.dark, 0.2)}`)
  })

  it('mixes leftover fffe00 the same way, with no apply-palette remap', () => {
    render(<SheetHarness theme="dark" swatches={[{ color: LEFTOVER_YELLOW, state: 'remove' }]} />)

    expect(swatchFill('remove', LEFTOVER_YELLOW)).toBe(DARK_LEFTOVER_FILL)
    expect(swatchFill('remove', LEFTOVER_YELLOW)).toBe(
      `#${mixSrgb(LEFTOVER_YELLOW, SHEET_SURFACE.dark, 0.2)}`,
    )
  })
})
