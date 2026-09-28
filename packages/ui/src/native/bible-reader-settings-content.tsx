import { BIBLE_READER_FONT } from '@youversion/platform-react-ui'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Button } from '../components/ui/button'
import { Text } from '../components/ui/text'
import { useTokens } from '../hooks/use-tokens'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import { INTER_FONT, UNTITLED_SERIF_FONT, type FontFamily } from '../lib/reader-fonts'
import { READER_LINE_SPACING } from '../stores/types/reader-line-spacing'
import type { Tokens } from '../theme'
import { fontMapKey } from '../theme/fonts'

const CONTROL_RADIUS = 8
const SIZE_CONTROL_HEIGHT = 64
const FONT_CONTROL_HEIGHT = 72
const LINE_BAR_WIDTH = 32
const LINE_BAR_HEIGHT = 2

const FONT_CHOICES = [
  { testID: 'font-inter', family: INTER_FONT, nameKey: 'interFontName' },
  { testID: 'font-serif', family: UNTITLED_SERIF_FONT, nameKey: 'untitledSerifFontName' },
] as const

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

function selectedFill(tokens: Tokens): ViewStyle {
  return {
    backgroundColor: tokens.foreground,
    borderColor: tokens.foreground,
  }
}

function inverseLabel(tokens: Tokens): TextStyle {
  return { color: tokens.background }
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
  const serifFamily = fontMapKey(tokens.fontFamily.serif, 400, 'normal')
  const decreaseDisabled = fontSize <= BIBLE_READER_FONT.MIN
  const increaseDisabled = fontSize >= BIBLE_READER_FONT.MAX

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
            style={[styles.pairStart, styles.sizeButton]}
          >
            <Button.Text style={styles.smallSample}>A</Button.Text>
          </Button>
          <Button
            testID="increase-font-size"
            accessibilityLabel={t('increaseFontSizeAriaLabel')}
            variant="secondary"
            disabled={increaseDisabled}
            onPress={onFontIncreased}
            style={[styles.pairEnd, styles.sizeButton]}
          >
            <Button.Text style={styles.largeSample}>A</Button.Text>
          </Button>
        </View>
        <Button
          testID="line-spacing"
          accessibilityLabel={t('changeLineSpacingAriaLabel')}
          variant="secondary"
          onPress={onChangeLineSpacing}
          style={styles.spacingButton}
        >
          <View style={{ gap: lineSpacingGap(lineSpacing) }}>
            <View
              testID="line-spacing-bar"
              style={[styles.lineBar, { backgroundColor: tokens.foreground }]}
            />
            <View style={[styles.lineBar, { backgroundColor: tokens.foreground }]} />
            <View style={[styles.lineBar, { backgroundColor: tokens.foreground }]} />
          </View>
        </Button>
      </View>
      <View style={styles.fontPair}>
        {FONT_CHOICES.map((choice, index) => {
          const selected = fontFamily === choice.family
          const nameStyle: TextStyle[] = []
          if (selected) {
            nameStyle.push(inverseLabel(tokens))
          }
          if (choice.family === UNTITLED_SERIF_FONT) {
            nameStyle.push({ fontFamily: serifFamily })
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
                styles.fontButton,
                index === 0 ? styles.pairStart : styles.pairEnd,
                selected ? selectedFill(tokens) : null,
              ]}
            >
              <View style={styles.fontCopy}>
                <Text variant="muted" style={selected ? inverseLabel(tokens) : undefined}>
                  {t('font')}
                </Text>
                <Button.Text style={nameStyle}>{t(choice.nameKey)}</Button.Text>
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
    gap: 16,
    padding: 16,
    width: '100%',
  },
  sizeRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 12,
  },
  sizePair: {
    flex: 1,
    flexDirection: 'row',
  },
  fontPair: {
    flexDirection: 'row',
    width: '100%',
  },
  pairStart: {
    borderBottomLeftRadius: CONTROL_RADIUS,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: CONTROL_RADIUS,
    borderTopRightRadius: 0,
    flex: 1,
  },
  pairEnd: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: CONTROL_RADIUS,
    borderTopLeftRadius: 0,
    borderTopRightRadius: CONTROL_RADIUS,
    flex: 1,
    marginLeft: -1,
  },
  sizeButton: {
    height: SIZE_CONTROL_HEIGHT,
  },
  spacingButton: {
    borderRadius: CONTROL_RADIUS,
    height: SIZE_CONTROL_HEIGHT,
    width: 64,
  },
  smallSample: {
    fontSize: 14,
    lineHeight: 20,
  },
  largeSample: {
    fontSize: 28,
    lineHeight: 32,
  },
  lineBar: {
    borderRadius: 1,
    height: LINE_BAR_HEIGHT,
    width: LINE_BAR_WIDTH,
  },
  fontButton: {
    alignItems: 'stretch',
    height: FONT_CONTROL_HEIGHT,
    paddingHorizontal: 12,
  },
  fontCopy: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
  },
})
