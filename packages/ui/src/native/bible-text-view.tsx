import { useState } from 'react'
import { Platform } from 'react-native'
import BibleTextViewDOM from '../dom/bible-text-view'
import type { BibleTextViewProps as DomBibleTextViewProps } from '../dom/bible-text-view'
import FootnoteContent from '../dom/footnote-content'
import type { FootnoteData } from '@youversion/platform-react-ui'
import { NativeSheet } from './native-sheet'

export type BibleTextViewProps = DomBibleTextViewProps & {
  onFootnotePress?: (data: FootnoteData) => Promise<void>
}

export function BibleTextView({
  onFootnotePress: consumerOnFootnotePress,
  ...domProps
}: BibleTextViewProps) {
  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)

  const onFootnotePress =
    Platform.OS !== 'web'
      ? (consumerOnFootnotePress ??
        (async (data: FootnoteData) => setFootnoteData(data)))
      : undefined

  return (
    <>
      <BibleTextViewDOM {...domProps} onFootnotePress={onFootnotePress} />
      {footnoteData && !consumerOnFootnotePress && (
        <NativeSheet isOpen onClose={() => setFootnoteData(null)}>
          <FootnoteContent
            data={footnoteData}
            theme={domProps.theme === 'system' ? undefined : domProps.theme}
            appKey={domProps.appKey}
          />
        </NativeSheet>
      )}
    </>
  )
}
