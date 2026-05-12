import { useCallback } from 'react'
import { useMMKVNumber, useMMKVString } from 'react-native-mmkv'
import { BIBLE_READER_FONT, clampBibleReaderFontSize } from '@youversion/platform-react-ui'

import { mmkvStorage, READER_FONT_FAMILY_KEY, READER_FONT_SIZE_KEY } from '../lib/storage'
import { SOURCE_SERIF_FONT, type FontFamily } from '../lib/reader-fonts'

export type ReaderSettings = {
  fontSize: number
  fontFamily: FontFamily
  setFontSize: (size: number) => void
  setFontFamily: (fontFamily: FontFamily) => void
}

export function useReaderSettings(): ReaderSettings {
  const [storedFontSize, setStoredFontSize] = useMMKVNumber(READER_FONT_SIZE_KEY, mmkvStorage)
  const [storedFontFamily, setStoredFontFamily] = useMMKVString(READER_FONT_FAMILY_KEY, mmkvStorage)

  // Clamp persisted size into BIBLE_READER_FONT range so stale MMKV values
  // (older app version, manual edit) can't strand the reader on an unreachable size.
  const fontSize =
    storedFontSize != null ? clampBibleReaderFontSize(storedFontSize) : BIBLE_READER_FONT.DEFAULT
  const fontFamily: FontFamily = storedFontFamily ?? SOURCE_SERIF_FONT

  const setFontSize = useCallback(
    (size: number) => {
      setStoredFontSize(clampBibleReaderFontSize(size))
    },
    [setStoredFontSize],
  )

  const setFontFamily = useCallback(
    (nextFont: FontFamily) => {
      setStoredFontFamily(nextFont)
    },
    [setStoredFontFamily],
  )

  return {
    fontSize,
    fontFamily,
    setFontSize,
    setFontFamily,
  }
}
