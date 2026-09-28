import { BIBLE_READER_FONT } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Button } from '../components/ui/button'
import { Text } from '../components/ui/text'
import { useTheme, type Theme } from '../hooks/use-theme'
import { useTokens } from '../hooks/use-tokens'
import type { SdkTranslationKey } from '../i18n/types'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { INTER_FONT, UNTITLED_SERIF_FONT, type FontFamily } from '../lib/reader-fonts'
import { READER_LINE_SPACING } from '../stores/types/reader-line-spacing'
import type { Tokens } from '../theme'
import { fontMapKey, sansFace } from '../theme/fonts'

const CONTROL_RADIUS = 8
const ROW_GAP = 16
const LINE_BAR_WIDTH = 32
const LINE_BAR_HEIGHT = 2

const FONT_CHOICES = [
  { testID: 'font-inter', family: INTER_FONT, nameKey: 'interFontName' },
  { testID: 'font-serif', family: UNTITLED_SERIF_FONT, nameKey: 'untitledSerifFontName' },
] as const satisfies ReadonlyArray<{
  testID: string
  family: FontFamily
  nameKey: SdkTranslationKey
}>

export type BibleReaderSettingsContentProps = {
  fontSize: number
  fontFamily: FontFamily
  lineSpacing: number
  onFontIncreased: () => void
  onFontDecreased: () => void
  onFontSelected: (fontFamily: FontFamily) => void
  onChangeLineSpacing: () => void
}

function lineSpacingGap(lineSpacing: number): number {
  if (lineSpacing === READER_LINE_SPACING.LG) {
    return 8
  }
  if (lineSpacing === READER_LINE_SPACING.SM) {
    return 4
  }
  return 6
}

function selectedFontFill(tokens: Tokens, theme: Theme): ViewStyle {
  if (theme === 'dark') {
    return {
      backgroundColor: tokens.background,
      borderColor: tokens.border,
    }
  }
  return {
    backgroundColor: tokens.foreground,
    borderColor: tokens.foreground,
  }
}

export function BibleReaderSettingsContent({
  fontSize,
  fontFamily,
  lineSpacing,
  onFontIncreased,
  onFontDecreased,
  onFontSelected,
  onChangeLineSpacing,
}: BibleReaderSettingsContentProps): ReactNode {
  const { t } = useSdkTranslation()
  const tokens = useTokens()
  const theme = useTheme()
  const serifFamily = fontMapKey(tokens.fontFamily.serif, 400, 'normal')
  const decreaseDisabled = fontSize <= BIBLE_READER_FONT.MIN
  const increaseDisabled = fontSize >= BIBLE_READER_FONT.MAX
  let seamColor = tokens.background
  let sampleColor = tokens.foreground
  if (theme === 'dark') {
    seamColor = tokens.border
    sampleColor = tokens.mutedForeground
  }
  const seam: ViewStyle = { borderWidth: 1, borderColor: seamColor }
  const sampleStyle = { color: sampleColor }

  return (
    <View
      testID="bible-reader-settings"
      style={[styles.root, { backgroundColor: tokens.background }]}
    >
      <View style={styles.sizeRow}>
        <View style={styles.sizePair}>
          <Button
            testID="decrease-font-size"
            accessibilityLabel={t('decreaseFontSizeAriaLabel')}
            variant="secondary"
            disabled={decreaseDisabled}
            onPress={onFontDecreased}
            style={[styles.segmentStart, styles.sizeButton, seam]}
          >
            <Button.Text style={[styles.smallSample, sampleStyle]}>A</Button.Text>
          </Button>
          <Button
            testID="increase-font-size"
            accessibilityLabel={t('increaseFontSizeAriaLabel')}
            variant="secondary"
            disabled={increaseDisabled}
            onPress={onFontIncreased}
            style={[styles.segmentEnd, styles.sizeButton, seam]}
          >
            <Button.Text style={[styles.largeSample, sampleStyle]}>A</Button.Text>
          </Button>
        </View>
        <Button
          testID="line-spacing"
          accessibilityLabel={t('changeLineSpacingAriaLabel')}
          variant="secondary"
          onPress={onChangeLineSpacing}
          style={[styles.spacingButton, seam]}
        >
          <View style={{ gap: lineSpacingGap(lineSpacing) }}>
            <View
              testID="line-spacing-bar"
              style={[styles.lineBar, { backgroundColor: sampleColor }]}
            />
            <View style={[styles.lineBar, { backgroundColor: sampleColor }]} />
            <View style={[styles.lineBar, { backgroundColor: sampleColor }]} />
          </View>
        </Button>
      </View>
      <View style={styles.fontPair}>
        {FONT_CHOICES.map((choice, index) => {
          const selected = fontFamily === choice.family
          let nameColor = tokens.foreground
          let labelColor = tokens.mutedForeground
          if (selected && theme === 'light') {
            nameColor = tokens.background
            labelColor = tokens.background
          }
          let fontSurface: ViewStyle | null = null
          if (selected) {
            fontSurface = selectedFontFill(tokens, theme)
          } else if (theme === 'dark') {
            fontSurface = {
              backgroundColor: tokens.muted,
              borderColor: tokens.border,
            }
          }
          let nameFace: TextStyle = sansFace(tokens.fontFamily.sans, 400)
          if (choice.family === UNTITLED_SERIF_FONT) {
            nameFace = { fontFamily: serifFamily }
          }
          return (
            <Button
              key={choice.testID}
              testID={choice.testID}
              accessibilityLabel={t(choice.nameKey)}
              accessibilityState={{ selected }}
              variant="outline"
              onPress={() => {
                onFontSelected(choice.family)
              }}
              style={[
                index === 0 ? styles.segmentStart : styles.segmentEnd,
                styles.fontButton,
                fontSurface,
              ]}
            >
              <View style={styles.fontCopy}>
                <Text variant="muted" style={[styles.fontLabel, { color: labelColor }]}>
                  {t('font')}
                </Text>
                <Text style={[styles.fontName, { color: nameColor }, nameFace]}>
                  {t(choice.nameKey)}
                </Text>
              </View>
            </Button>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    gap: ROW_GAP,
    padding: 16,
    width: '100%',
  },
  sizeRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: ROW_GAP,
  },
  sizePair: {
    flex: 1,
    flexDirection: 'row',
  },
  fontPair: {
    flexDirection: 'row',
    width: '100%',
  },
  segmentStart: {
    borderBottomRightRadius: 0,
    borderRadius: CONTROL_RADIUS,
    borderTopRightRadius: 0,
    flex: 1,
  },
  segmentEnd: {
    borderBottomLeftRadius: 0,
    borderRadius: CONTROL_RADIUS,
    borderTopLeftRadius: 0,
    flex: 1,
    marginLeft: -1,
  },
  sizeButton: {
    height: 'auto',
    paddingVertical: 12,
  },
  spacingButton: {
    borderRadius: CONTROL_RADIUS,
    height: 'auto',
    width: 64,
  },
  smallSample: {
    fontSize: 12,
    lineHeight: 16,
  },
  largeSample: {
    fontSize: 30,
    lineHeight: 36,
  },
  lineBar: {
    borderRadius: 1,
    height: LINE_BAR_HEIGHT,
    width: LINE_BAR_WIDTH,
  },
  fontButton: {
    alignItems: 'stretch',
    height: 'auto',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  fontCopy: {
    alignItems: 'flex-start',
    flex: 1,
    gap: 4,
  },
  fontLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  fontName: {
    fontSize: 16,
    lineHeight: 22,
  },
})
