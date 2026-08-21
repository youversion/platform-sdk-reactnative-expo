'use dom'

import type { FootnoteData } from '@youversion/platform-react-ui'
import { FootnoteContent as WebFootnoteContent } from '@youversion/platform-react-ui'

import { applySDKConfig } from '../lib/dom-apply'
import type { InternalLocaleProps } from '../lib/locale-props'
import { SHEET_SURFACE } from '../lib/native-sheet-theme'
import { YouVersionProvider } from '../lib/web-yv-provider'

export type FootnoteContentDOMProps = {
  data: FootnoteData
  theme?: 'light' | 'dark'
  fontSize?: number
  appKey: string
  apiHost: string
  installationId: string
  dom?: import('expo/dom').DOMProps
} & InternalLocaleProps

export default function FootnoteContentDOM({
  data,
  theme = 'light',
  fontSize,
  appKey,
  apiHost,
  installationId,
  locale,
}: FootnoteContentDOMProps) {
  applySDKConfig({ appKey, apiHost, installationId })
  return (
    <YouVersionProvider appKey={appKey} theme={theme} locale={locale}>
      <style href="yv-footnote-content-scroll-lock" precedence="medium">
        {`html, body { overflow: hidden }`}
      </style>
      <style>
        {`html, body { background: ${SHEET_SURFACE[theme]}; }
[data-yv-sdk][data-yv-theme="${theme}"] { --yv-background: ${SHEET_SURFACE[theme]}; }`}
      </style>
      <WebFootnoteContent {...data} fontSize={fontSize} theme={theme} />
    </YouVersionProvider>
  )
}
