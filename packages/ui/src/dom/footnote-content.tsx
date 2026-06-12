'use dom'

import { withDomBridgeRecovery } from '../lib/dom-bridge-recovery'

import type { FootnoteData } from '@youversion/platform-react-ui'
import { FootnoteContent as WebFootnoteContent } from '@youversion/platform-react-ui'

import { applySDKConfig } from '../lib'
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
}

function FootnoteContentDOM({
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

const RecoveredFootnoteContentDOM = withDomBridgeRecovery(FootnoteContentDOM)
export default RecoveredFootnoteContentDOM
