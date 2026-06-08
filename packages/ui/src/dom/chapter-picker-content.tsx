'use dom'

import {
  BibleChapterPicker,
  type BibleChapterPickerSelectData,
} from '@youversion/platform-react-ui'
import { useEffect } from 'react'

import { YouVersionProvider } from '../lib/web-yv-provider'

export type ChapterPickerContentDOMProps = {
  appKey: string
  book?: string
  chapter?: string
  versionId?: number
  theme?: 'light' | 'dark'
  onSelect?: (data: BibleChapterPickerSelectData) => Promise<void>
  dom?: import('expo/dom').DOMProps
}

export default function ChapterPickerContentDOM({
  appKey,
  book,
  chapter,
  versionId = 3034,
  theme = 'light',
  onSelect,
}: ChapterPickerContentDOMProps) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-yv-chapter-picker-shell]')
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
      <style>{chapterPickerStyles}</style>
      <div data-yv-sdk data-yv-theme={theme} data-yv-chapter-picker-shell>
        <BibleChapterPicker.Root
          book={book}
          chapter={chapter}
          versionId={versionId}
          background={theme}
        >
          <BibleChapterPicker.Content onSelect={onSelect} />
        </BibleChapterPicker.Root>
      </div>
    </YouVersionProvider>
  )
}

const chapterPickerStyles = `
html,
body {
  height: 100%;
  overflow: hidden;
}

[data-yv-chapter-picker-shell] {
  --yv-keyboard-overlap: 0px;
  width: 100%;
  height: 100vh;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--yv-background);
  color: var(--yv-foreground);
}

[data-yv-chapter-picker-shell] > [data-slot='accordion'] {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  align-content: end;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

[data-yv-chapter-picker-shell] > section {
  flex: 0 0 auto;
  padding-bottom: calc(1rem + var(--yv-keyboard-overlap));
}
`
