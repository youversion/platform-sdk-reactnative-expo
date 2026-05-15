'use dom'

import { useEffect } from 'react'
import {
  BibleVersionPicker,
  YouVersionProvider,
} from '@youversion/platform-react-ui'

export type VersionPickerContentDOMProps = {
  appKey: string
  versionId?: number
  theme?: 'light' | 'dark'
  onVersionChange?: (versionId: number) => Promise<void>
  dom?: import('expo/dom').DOMProps
}

export default function VersionPickerContentDOM({
  appKey,
  versionId = 3034,
  theme = 'light',
  onVersionChange,
}: VersionPickerContentDOMProps) {
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
        <BibleVersionPicker.Root
          versionId={versionId}
          onVersionChange={onVersionChange}
          background={theme}
          onVersionPickerPress={() => {}}
        >
          <BibleVersionPicker.Content />
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
}
`
