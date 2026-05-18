'use dom'

import { useEffect, useState } from 'react'
import {
  BibleVersionPicker,
  BibleLanguagePickerContent,
  BibleVersionPickerLanguageTrigger,
  YouVersionProvider,
} from '@youversion/platform-react-ui'

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
    viewport.addEventListener('scroll', updateKeyboardOverlap)
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
      <div data-yv-sdk data-yv-version-picker-shell>
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
                className={`yv:min-h-0 yv:h-full yv:transition-all yv:duration-300 yv:ease-out yv:motion-reduce:transition-none ${
                  showLanguagePicker
                    ? 'yv:shrink yv:opacity-0 yv:pointer-events-none yv:blur-sm yv:scale-95'
                    : 'yv:grow yv:opacity-100 yv:pointer-events-auto yv:blur-none yv:scale-100'
                }`}
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
                  <div style={{ paddingInline: '1rem', display: 'flex', justifyContent: 'end' }}>
                    <BibleVersionPickerLanguageTrigger
                      disabled={false}
                      onClick={() => {
                        setShowLanguagePicker((prevBool) => !prevBool)
                      }}
                    />
                  </div>
                  <BibleVersionPicker.Content open={!showLanguagePicker} />
                </div>
              </div>

              <div
                data-yv-bible-language-picker
                className={`yv:min-h-0 yv:overflow-hidden yv:absolute yv:inset-0 yv:transition-all yv:duration-300 yv:ease-out yv:motion-reduce:transition-none ${
                  showLanguagePicker
                    ? 'yv:grow yv:opacity-100 yv:pointer-events-auto yv:blur-none yv:scale-100'
                    : 'yv:shrink yv:opacity-0 yv:pointer-events-none yv:blur-sm yv:scale-95'
                }`}
              >
                <BibleLanguagePickerContent
                  onRequestClose={() => {
                    setShowLanguagePicker((prevBool) => !prevBool)
                  }}
                  open={showLanguagePicker}
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

  [data-yv-bible-language-picker],
  [data-yv-bible-version-picker] {
    height: 100%;

    section:has([data-slot="input-group"]) {
      flex: 0 0 auto;
      padding-bottom: calc(1rem + var(--yv-keyboard-overlap));
    }
  }
}
`
