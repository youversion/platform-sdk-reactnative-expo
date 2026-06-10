'use dom'

import {
  BibleLanguagePickerContent,
  BibleVersionPicker,
  BibleVersionPickerLanguageTrigger,
} from '@youversion/platform-react-ui'
import { useEffect, useState, type MouseEvent, type TouchEvent } from 'react'

import { getVersionPickerPanelClassName } from '../lib/version-picker-panels'
import { YouVersionProvider } from '../lib/web-yv-provider'

export type VersionPickerContentDOMProps = {
  appKey: string
  versionId?: number
  theme?: 'light' | 'dark'
  resetKey?: number
  onVersionChange?: (versionId: number) => Promise<void>
  dom?: import('expo/dom').DOMProps
}

export default function VersionPickerContentDOM({
  appKey,
  versionId = 3034,
  theme = 'light',
  resetKey,
  onVersionChange,
}: VersionPickerContentDOMProps) {
  const [showLanguagePicker, setShowLanguagePicker] = useState(false)

  useEffect(() => {
    setShowLanguagePicker(false)
  }, [resetKey])

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-yv-version-picker-shell]')
    const viewport = window.visualViewport
    if (!root || !viewport) return

    const updateKeyboardOverlap = () => {
      const overlap = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      root.style.setProperty('--yv-keyboard-overlap', `${overlap}px`)
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) {
        event.target.scrollIntoView({ block: 'nearest' })
      }
    }

    updateKeyboardOverlap()
    viewport.addEventListener('resize', updateKeyboardOverlap)
    viewport.addEventListener('scroll', updateKeyboardOverlap, { passive: true })
    root.addEventListener('focusin', handleFocusIn)

    return () => {
      viewport.removeEventListener('resize', updateKeyboardOverlap)
      viewport.removeEventListener('scroll', updateKeyboardOverlap)
      root.removeEventListener('focusin', handleFocusIn)
    }
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
  --yv-keyboard-overlap: 0px;
  width: 100%;
  height: 100vh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--yv-background);
  color: var(--yv-foreground);

  [data-yv-bible-language-picker],
  [data-yv-bible-version-picker] {
    height: 100%;

    /* This allows the keyboard to appear and content to resize to account for it. */
    section:has([data-slot="input-group"]) {
      flex: 0 0 auto;
      padding-bottom: calc(1rem + var(--yv-keyboard-overlap));
    }
  }
}
`
