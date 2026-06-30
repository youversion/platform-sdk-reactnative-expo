'use dom'

import {
  BibleChapterPicker,
  type BibleChapterPickerSelectData,
} from '@youversion/platform-react-ui'
import { useEffect } from 'react'

import { attachPickerKeyboardViewportListeners } from '../lib/picker-keyboard-viewport'
import { YouVersionProvider } from '../lib/web-yv-provider'

export type ChapterPickerContentDOMProps = {
  appKey: string
  book?: string
  chapter?: string
  versionId?: number
  theme?: 'light' | 'dark'
  resetKey?: number
  onSelect?: (data: BibleChapterPickerSelectData) => Promise<void>
  dom?: import('expo/dom').DOMProps
}

export default function ChapterPickerContentDOM({
  appKey,
  book,
  chapter,
  versionId = 3034,
  theme = 'light',
  resetKey,
  onSelect,
}: ChapterPickerContentDOMProps) {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-yv-chapter-picker-shell]')
    if (!root) return

    return attachPickerKeyboardViewportListeners(root)
  }, [])

  return (
    <YouVersionProvider appKey={appKey} theme={theme}>
      <style>{chapterPickerStyles}</style>
      <div data-yv-sdk data-yv-theme={theme} data-yv-chapter-picker-shell>
        {/* key remounts the picker tree when resetKey changes (on sheet close) to clear scroll and filter state */}
        <BibleChapterPicker.Root
          key={resetKey}
          book={book}
          chapter={chapter}
          versionId={versionId}
          background={theme}
          // Required, not a no-op: the Web SDK renders the picker inline only when
          // onChapterPickerPress is present; omitting it wraps Content in its own
          // Popover (a collapsed trigger). Selection flows through Content's onSelect,
          // so this handler is intentionally empty.
          onChapterPickerPress={() => {}}
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

[data-yv-chapter-picker-shell] > [data-slot='accordion'] {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

[data-yv-chapter-picker-shell] > section {
  flex: 0 0 auto;
  padding-bottom: 1rem;
}
`
