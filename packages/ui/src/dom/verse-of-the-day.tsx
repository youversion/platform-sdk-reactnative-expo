'use dom'

import { VerseOfTheDay } from '@youversion/platform-react-ui'
import type { VerseOfTheDayProps as WebVerseOfTheDayProps } from '@youversion/platform-react-ui'
import { applySDKConfig } from '../lib/dom-apply'
import { ContentSizedBody } from '../lib/content-sized-body'
import type { InternalVersionFilterProps } from '../lib/version-filter-props'
import { YouVersionProvider } from '../lib/web-yv-provider'

export type VerseOfTheDayProps = WebVerseOfTheDayProps & {
  appKey: string
  apiHost: string
  installationId: string
  theme?: 'light' | 'dark' | 'system'
  dom?: import('expo/dom').DOMProps
}

type VerseOfTheDayDOMProps = VerseOfTheDayProps & InternalVersionFilterProps

export default function VerseOfTheDayDOM({
  appKey,
  apiHost,
  installationId,
  theme = 'light',
  onShare,
  permittedVersionIds,
  excludedVersionIds,
  permittedLanguageTags,
  ...props
}: VerseOfTheDayDOMProps) {
  applySDKConfig({ appKey, apiHost, installationId })

  return (
    <YouVersionProvider
      appKey={appKey}
      theme={theme}
      permittedVersionIds={permittedVersionIds}
      excludedVersionIds={excludedVersionIds}
      permittedLanguageTags={permittedLanguageTags}
    >
      <ContentSizedBody />
      <VerseOfTheDay {...props} onShare={onShare} />
    </YouVersionProvider>
  )
}
