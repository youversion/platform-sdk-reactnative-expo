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

const EMPTY_FOOTNOTE: FootnoteData = {
  verseNum: '',
  notes: [],
  verseHtml: '',
}

export function BibleTextView({
  onFootnotePress: consumerOnFootnotePress,
  ...domProps
}: BibleTextViewProps) {
  const [footnoteData, setFootnoteData] = useState<FootnoteData | null>(null)
  const [footnoteOpenKey, setFootnoteOpenKey] = useState(0)

  const onFootnotePress =
    Platform.OS !== 'web'
      ? (consumerOnFootnotePress ??
        (async (data: FootnoteData) => {
          setFootnoteData(data)
          setFootnoteOpenKey((key) => key + 1)
        }))
      : undefined

  const showSheet = Platform.OS !== 'web' && !consumerOnFootnotePress

  return (
    <>
      <BibleTextViewDOM {...domProps} onFootnotePress={onFootnotePress} />
      {showSheet && (
        <NativeSheet
          isOpen={!!footnoteData}
          onClose={() => setFootnoteData(null)}
          openKey={footnoteOpenKey}
        >
          <FootnoteContent
            dom={{ matchContents: true }}
            data={footnoteData ?? EMPTY_FOOTNOTE}
            theme={domProps.theme === 'system' ? undefined : domProps.theme}
            fontSize={domProps.fontSize}
            appKey={domProps.appKey}
          />
        </NativeSheet>
      )}
    </>
  )
}
