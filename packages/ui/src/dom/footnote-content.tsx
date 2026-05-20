'use dom'

import type { FootnoteData } from '@youversion/platform-react-ui'
import {
  FootnoteContent as WebFootnoteContent,
  YouVersionProvider,
} from '@youversion/platform-react-ui'
import { applySDKConfig } from '../lib'

export type FootnoteContentDOMProps = {
  data: FootnoteData
  theme?: 'light' | 'dark'
  fontSize?: number
  appKey: string
  apiHost: string
  installationId: string
  dom?: import('expo/dom').DOMProps
}

export default function FootnoteContentDOM({
  data,
  theme = 'light',
  fontSize,
  appKey,
  apiHost,
  installationId,
}: FootnoteContentDOMProps) {
  applySDKConfig({ appKey, apiHost, installationId })
  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <style href="yv-footnote-content-scroll-lock" precedence="medium">
        {'html, body { overflow: hidden; }'}
      </style>
      <WebFootnoteContent {...data} fontSize={fontSize} theme={theme} />
    </YouVersionProvider>
  )
}
