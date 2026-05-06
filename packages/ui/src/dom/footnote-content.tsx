'use dom'

import {
  FootnoteContent as WebFootnoteContent,
  YouVersionProvider,
} from '@youversion/platform-react-ui'
import type { FootnoteData } from '../lib/footnote-data'

export type FootnoteContentDOMProps = {
  data: FootnoteData
  theme?: 'light' | 'dark'
  fontSize?: number
  appKey: string
  dom?: import('expo/dom').DOMProps
}

export default function FootnoteContentDOM({
  data,
  theme = 'light',
  fontSize,
  appKey,
}: FootnoteContentDOMProps) {
  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <WebFootnoteContent {...data} fontSize={fontSize} theme={theme} />
    </YouVersionProvider>
  )
}
