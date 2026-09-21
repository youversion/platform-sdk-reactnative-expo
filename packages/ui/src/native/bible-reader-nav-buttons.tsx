import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

import { Button } from '../components/ui/button'
import { useSdkTranslation } from '../i18n/use-sdk-translation'
import {
  READER_OVERLAY_NAV_EDGE_PADDING,
  READER_OVERLAY_NAV_SIZE,
} from '../lib/reader-bottom-scroll-padding'
import { ChevronLeftIcon } from './icons/chevron-left-icon'
import { ChevronRightIcon } from './icons/chevron-right-icon'

export type BibleReaderNavButtonsProps = {
  canGoPrevious: boolean
  canGoNext: boolean
  onPreviousChapterPress: () => void
  onNextChapterPress: () => void
}

export function BibleReaderNavButtons({
  canGoPrevious,
  canGoNext,
  onPreviousChapterPress,
  onNextChapterPress,
}: BibleReaderNavButtonsProps): ReactNode {
  const { t } = useSdkTranslation()

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Button
        variant="secondary"
        size="icon"
        disabled={!canGoPrevious}
        onPress={onPreviousChapterPress}
        accessibilityLabel={t('previousChapterAriaLabel')}
        testID="reader-toolbar-previous-chapter"
        style={styles.previous}
      >
        <Button.Icon as={ChevronLeftIcon} />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        disabled={!canGoNext}
        onPress={onNextChapterPress}
        accessibilityLabel={t('nextChapterAriaLabel')}
        testID="reader-toolbar-next-chapter"
        style={styles.next}
      >
        <Button.Icon as={ChevronRightIcon} />
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  previous: {
    position: 'absolute',
    left: READER_OVERLAY_NAV_EDGE_PADDING,
    bottom: READER_OVERLAY_NAV_EDGE_PADDING,
    height: READER_OVERLAY_NAV_SIZE,
    width: READER_OVERLAY_NAV_SIZE,
  },
  next: {
    position: 'absolute',
    right: READER_OVERLAY_NAV_EDGE_PADDING,
    bottom: READER_OVERLAY_NAV_EDGE_PADDING,
    height: READER_OVERLAY_NAV_SIZE,
    width: READER_OVERLAY_NAV_SIZE,
  },
})
