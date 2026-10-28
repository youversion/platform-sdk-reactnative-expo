import type { Block, Inline } from './parse-passage'
import { resolveChars } from './styles'

export type LineBox = { y: number; height: number }

type LineMetrics = { text: string; y: number; height: number }

// Lowercase runs are drawn as smaller capitals. The line string contains those capitals.
export function applySmallCaps(text: string): string {
  return text.replace(/\p{Ll}+/gu, (letters) => letters.toUpperCase())
}

type Needle = { verse: number; text: string }

// The first readable run of a verse, in the order the paragraph lays the verses out.
// Labels, notes, and raised runs are inline views, so they are not in the line string.
function verseNeedles(block: Block, smallCaps: boolean): Needle[] {
  const needles: Needle[] = []
  for (const segment of block.segments) {
    if (segment.verse === null) {
      continue
    }
    needles.push({ verse: segment.verse, text: firstReadableText(segment.inlines, smallCaps) })
  }
  return needles
}

function firstReadableText(inlines: readonly Inline[], smallCaps: boolean): string {
  for (const inline of inlines) {
    if (inline.kind !== 'text') {
      continue
    }
    const chars = resolveChars(inline.classes)
    if (chars.raised) {
      continue
    }
    if (chars.smallCaps || smallCaps) {
      return applySmallCaps(inline.text)
    }
    return inline.text
  }
  return ''
}

// Where each verse's words sit inside the paragraph's line boxes. `null` when the
// line string does not contain those words, so the caller can keep the paragraph box.
export function verseLineBoxes(
  lines: readonly LineMetrics[],
  block: Block,
  smallCaps: boolean,
): ReadonlyMap<number, LineBox> | null {
  const actual = lines.map((line) => line.text).join('')
  const needles = verseNeedles(block, smallCaps)
  const points: { verse: number; index: number }[] = []
  let cursor = 0
  for (const needle of needles) {
    if (needle.text === '') {
      points.push({ verse: needle.verse, index: cursor })
      continue
    }
    const index = actual.indexOf(needle.text, cursor)
    if (index < 0) {
      break
    }
    points.push({ verse: needle.verse, index })
    cursor = index + needle.text.length
  }
  if (points.length === 0) {
    return null
  }

  const boxes = new Map<number, LineBox>()
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]
    if (point === undefined) {
      continue
    }
    const next = points[i + 1]
    const end = next === undefined ? actual.length : next.index
    const box = boxCovering(lines, point.index, end)
    if (box === null) {
      continue
    }
    const previous = boxes.get(point.verse)
    if (previous === undefined) {
      boxes.set(point.verse, box)
      continue
    }
    const top = Math.min(previous.y, box.y)
    const bottom = Math.max(previous.y + previous.height, box.y + box.height)
    boxes.set(point.verse, { y: top, height: bottom - top })
  }
  if (boxes.size === 0) {
    return null
  }
  return boxes
}

function boxCovering(lines: readonly LineMetrics[], start: number, end: number): LineBox | null {
  let cursor = 0
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  let found = false
  const last = Math.max(start, end - 1)
  for (const line of lines) {
    const lineStart = cursor
    const lineEnd = cursor + line.text.length
    if (last >= lineStart && start < lineEnd) {
      found = true
      top = Math.min(top, line.y)
      bottom = Math.max(bottom, line.y + line.height)
    }
    cursor = lineEnd
  }
  if (!found) {
    return null
  }
  return { y: top, height: bottom - top }
}

// The box that holds every requested verse found in this paragraph.
export function focusLineBox(
  boxes: ReadonlyMap<number, LineBox>,
  verses: readonly number[],
): LineBox | null {
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const verse of verses) {
    const box = boxes.get(verse)
    if (box === undefined) {
      continue
    }
    top = Math.min(top, box.y)
    bottom = Math.max(bottom, box.y + box.height)
  }
  if (bottom <= top) {
    return null
  }
  return { y: top, height: bottom - top }
}

// A short box is centered. A box taller than the screen is pinned under the top padding.
export function focusScrollOffset(
  top: number,
  height: number,
  viewportHeight: number,
  topPadding: number,
): number {
  if (height < viewportHeight) {
    return Math.max(0, top + height / 2 - viewportHeight / 2)
  }
  return Math.max(0, top - topPadding)
}
