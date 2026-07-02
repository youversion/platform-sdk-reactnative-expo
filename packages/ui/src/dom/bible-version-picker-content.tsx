'use dom'

import {
  BibleLanguagePickerContent,
  BibleVersionPicker,
  BibleVersionPickerLanguageTrigger,
} from '@youversion/platform-react-ui'
import { useEffect, useState, type MouseEvent, type TouchEvent } from 'react'

import { useDismissKeyboardOnClose } from '../lib/dom-dismiss-keyboard'
import { attachPickerKeyboardViewportListeners } from '../lib/picker-keyboard-viewport'
import { getVersionPickerPanelClassName } from '../lib/version-picker-panels'
import { YouVersionProvider } from '../lib/web-yv-provider'

export type VersionPickerContentDOMProps = {
  appKey: string
  versionId?: number
  theme?: 'light' | 'dark'
  resetKey?: number
  // Drives WebView keyboard dismissal on close; the native sheet flips this.
  isOpen?: boolean
  onVersionChange?: (versionId: number) => Promise<void>
  dom?: import('expo/dom').DOMProps
}

export default function VersionPickerContentDOM({
  appKey,
  versionId = 3034,
  theme = 'light',
  resetKey,
  isOpen,
  onVersionChange,
}: VersionPickerContentDOMProps) {
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)

  useDismissKeyboardOnClose(isOpen)

  // Reset language-panel visibility whenever the picker reopens (resetKey bumps
  // on each sheet open). Compare against the previous resetKey during render
  // rather than in an effect so the panel never paints a stale frame. This keeps
  // the panel DOM-owned (no key-based remount, which would change the DOM
  // component contract). See https://react.dev/learn/you-might-not-need-an-effect
  const [prevResetKey, setPrevResetKey] = useState(resetKey)
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey)
    setShowLanguagePicker(false)
  }

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-yv-version-picker-shell]')
    if (!root) return

    return attachPickerKeyboardViewportListeners(root)
  }, [])

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <style>{versionPickerStyles}</style>
      <div data-yv-sdk data-yv-theme={theme} data-yv-version-picker-shell>
        {/* key remounts the picker tree on each sheet open to reset scroll and filter state */}
        <BibleVersionPicker.Root
          key={resetKey}
          versionId={versionId}
          onVersionChange={onVersionChange}
          background={theme}
          onVersionPickerPress={() => {}}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            <div
              style={{
                display: 'grid',
                flexDirection: 'column',
                gridTemplateRows: '1fr',
                flexGrow: 1,
              }}
              className="yv:relative yv:min-h-0 yv:overflow-hidden"
            >
              <div
                data-yv-bible-version-picker
                className={getVersionPickerPanelClassName(showLanguagePicker, 'version')}
              >
                <div
                  style={{
                    display: 'grid',
                    flexDirection: 'column',
                    gridTemplateRows: 'auto 1fr',
                    flexGrow: 1,
                    height: '100%',
                    minHeight: 0,
                  }}
                >
                  <div
                    style={{
                      paddingTop: '1rem',
                      paddingInline: '1rem',
                      display: 'flex',
                      justifyContent: 'end',
                    }}
                  >
                    <BibleVersionPickerLanguageTrigger
                      onClick={(
                        event: MouseEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>,
                      ) => {
                        event.preventDefault()
                        setShowLanguagePicker(true)
                      }}
                    />
                  </div>
                  <BibleVersionPicker.Content open={true} />
                </div>
              </div>

              <div
                data-yv-bible-language-picker
                className={getVersionPickerPanelClassName(showLanguagePicker, 'language')}
              >
                <BibleLanguagePickerContent
                  onRequestClose={() => setShowLanguagePicker(false)}
                  open={true}
                />
              </div>
            </div>
          </div>
        </BibleVersionPicker.Root>
      </div>
    </YouVersionProvider>
  )
}

const versionPickerStyles = `
html,
body {
  height: 100%;
  overflow: hidden;
}

[data-yv-version-picker-shell] {
  --yv-visible-height: 100vh;
  --yv-viewport-offset-top: 0px;
  width: 100%;
  height: var(--yv-visible-height, 100vh);
  max-height: 100vh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--yv-background);
  color: var(--yv-foreground);
  transform: translateY(var(--yv-viewport-offset-top, 0px));
}

[data-yv-version-picker-shell] > * {
  min-height: 0;
  height: 100%;
}

[data-yv-version-picker-shell] [data-yv-bible-language-picker],
[data-yv-version-picker-shell] [data-yv-bible-version-picker] {
  height: 100%;
  min-height: 0;
}

[data-yv-version-picker-shell] [data-yv-bible-version-picker] > div,
[data-yv-version-picker-shell] [data-yv-bible-version-picker] [data-yv-sdk] {
  min-height: 0;
  height: 100%;
}

[data-yv-version-picker-shell] [data-yv-bible-language-picker] [data-yv-sdk],
[data-yv-version-picker-shell] [data-yv-bible-version-picker] [data-yv-sdk] {
  min-height: 0;
  height: 100%;
}

[data-yv-version-picker-shell] section:has([data-slot="input-group"]) {
  flex: 0 0 auto;
  padding-bottom: 1rem;
}
`
