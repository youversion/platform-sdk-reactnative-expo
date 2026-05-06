import { useState } from 'react'
import { Platform } from 'react-native'
import BibleReaderDOM from '../dom/bible-reader'
import type { BibleReaderProps as DomBibleReaderProps } from '../dom/bible-reader'
import FootnoteContent from '../dom/footnote-content'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { NativeSheet } from './native-sheet'

export type BibleReaderProps = DomBibleReaderProps & {
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

export function BibleReader({
  onFootnotePress: consumerOnFootnotePress,
  ...domProps
}: BibleReaderProps) {
  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)

  const onFootnotePress =
    Platform.OS !== 'web'
      ? (consumerOnFootnotePress ??
        (async (data: FootnoteData) => setFootnoteData(data)))
      : undefined

  return (
    <>
      <BibleReaderDOM {...domProps} onFootnotePress={onFootnotePress} />
      {footnoteData && !consumerOnFootnotePress && (
        <NativeSheet isOpen onClose={() => setFootnoteData(null)}>
          <FootnoteContent
            data={footnoteData}
            theme={domProps.themeBackground}
            fontSize={domProps.fontSize}
            appKey={domProps.appKey}
          />
        </NativeSheet>
      )}
    </>
  )
}
