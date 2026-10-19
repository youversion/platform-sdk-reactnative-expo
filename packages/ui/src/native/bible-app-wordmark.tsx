import type { ReactNode } from 'react'
import { Image, StyleSheet, type ImageSourcePropType } from 'react-native'
import { useTheme, type Theme } from '../hooks'
import blackText from '../../assets/bible-app-wordmark-black-text.png'
import whiteText from '../../assets/bible-app-wordmark-white-text.png'

const UNTRANSLATED_WORDMARK_TEXT = 'Bible App'

const SOURCE_BY_THEME = {
  light: blackText,
  dark: whiteText,
} satisfies Record<Theme, ImageSourcePropType>

type BibleAppWordmarkProps = {
  testID?: string
}

export function BibleAppWordmark({ testID }: BibleAppWordmarkProps): ReactNode {
  const theme = useTheme()

  return (
    <Image
      accessible
      accessibilityRole="image"
      accessibilityLabel={UNTRANSLATED_WORDMARK_TEXT}
      resizeMode="contain"
      source={SOURCE_BY_THEME[theme]}
      style={styles.wordmark}
      testID={testID}
    />
  )
}

const styles = StyleSheet.create({
  wordmark: {
    height: 24,
    width: (24 * 660) / 156,
  },
})
