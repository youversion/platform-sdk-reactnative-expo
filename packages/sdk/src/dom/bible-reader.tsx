'use dom'

import { YouVersionProvider, BibleReader } from '@youversion/platform-react-ui'

type UUID = `${string}-${string}-${string}-${string}-${string}`

// Monkey patch crypto.randomUUID since it's not available in React Native.
if (!crypto?.randomUUID) {
  crypto.randomUUID = () => '8675309' as UUID
}

export interface BibleReaderProps {
  appKey: string
  defaultVersionId?: number
  themeBackground?: 'light' | 'dark'
  onSettingsPress?: () => Promise<void>
  fontSize?: number
  fontFamily?: string
  backgroundColor?: string
  foregroundColor?: string
  dom?: import('expo/dom').DOMProps
}

export default function BibleReaderDOM({
  appKey,
  defaultVersionId = 3034,
  themeBackground = 'light',
  onSettingsPress,
  fontSize,
  fontFamily,
  backgroundColor,
  foregroundColor,
}: BibleReaderProps) {
  const overrideCss = `
    [data-slot="yv-bible-renderer"] {
      ${fontSize ? `--yv-reader-font-size: ${fontSize}px !important;` : ''}
      ${fontFamily ? `--yv-reader-font-family: ${fontFamily} !important;` : ''}
      ${backgroundColor ? `--yv-reader-bg: ${backgroundColor} !important;` : ''}
      ${foregroundColor ? `--yv-reader-fg: ${foregroundColor} !important;` : ''}
    }
  `

  return (
    <YouVersionProvider appKey={appKey} theme={themeBackground}>
      {/** biome-ignore lint/security/noDangerouslySetInnerHtml: This styling is intentional */}
      <style dangerouslySetInnerHTML={{ __html: overrideCss }} />
      <div style={{ position: 'relative', height: '100%', width: '100%' }}>
        <BibleReader.Root defaultVersionId={defaultVersionId}>
          <BibleReader.Content />
        </BibleReader.Root>
        {onSettingsPress && (
          <button
            type="button"
            onClick={() => onSettingsPress()}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 10,
              background: 'rgba(0,0,0,0.15)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Aa
          </button>
        )}
      </div>
    </YouVersionProvider>
  )
}
