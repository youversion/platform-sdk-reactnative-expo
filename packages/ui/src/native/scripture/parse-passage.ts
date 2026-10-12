import { transformBibleHtml } from '@youversion/platform-core'
import { parseHTML } from 'linkedom'

import { footnoteMarker } from '../../lib/footnote-html'

export type Inline =
  | { kind: 'text'; text: string; classes: readonly string[] }
  | { kind: 'label'; text: string }
  | { kind: 'note'; html: string }

export type Segment = { verse: number | null; inlines: Inline[] }

export type Block = {
  classes: readonly string[]
  heading: boolean
  segments: Segment[]
  /** Verses with a fragment in this block, for per-block memo checks. */
  verses: readonly number[]
}

export type VerseInfo = {
  /** Share text: every fragment, labels and notes dropped, whitespace collapsed. */
  text: string
  /** Footnote-sheet HTML: classed text spans, with `<sup>` letters where the notes sat. */
  html: string
  notes: string[]
}

export type ParsedPassage = {
  blocks: Block[]
  verses: ReadonlyMap<number, VerseInfo>
  rtl: boolean
}

const HIDDEN = new Set(['x', 'yv-n'])

/** Runs platform-core's transformer under linkedom, then flattens it into blocks of verse runs. */
export function parsePassage(rawHtml: string): ParsedPassage {
  let captured: Document | null = null
  // Keep the transformed Document instead of serializing and reparsing it.
  transformBibleHtml(rawHtml, {
    parseHtml: (html) => parseHTML(`<!doctype html><html><body>${html}</body></html>`).document,
    serializeHtml: (doc) => {
      captured = doc
      return ''
    },
  })
  const blocks = captured === null ? [] : walk(captured)
  return { blocks, verses: collectVerses(blocks), rtl: isRtlText(blocks) }
}

function walk(doc: Document): Block[] {
  const root = doc.querySelector('[data-yv-transformed]') ?? doc.body
  const blocks: Block[] = []
  // Poetry continuation lines (q2 after q1) sit outside any .yv-v; native SDKs give them to the last verse.
  let carried: number | null = null

  for (const el of Array.from(root.children)) {
    const classes = classList(el)
    // Chapter label ("Psalm 119"); the reader header already shows it, as in Swift and Web.
    if (classes.includes('cl')) {
      continue
    }
    const heading = classes.includes('yv-h') || isHeadingClass(classes)
    const segments: Segment[] = []
    // Core spaces a footnote off the word before it; Swift sets the icon against the
    // word, so that space moves to after the note. Holds the moved space's classes.
    let movedSpace: readonly string[] | null = null
    const push = (verse: number | null, given: Inline): void => {
      let inline = given
      const last = segments.at(-1)
      const tail = last?.inlines.at(-1)
      if (inline.kind === 'note' && tail?.kind === 'text' && tail.text.endsWith(' ')) {
        tail.text = tail.text.slice(0, -1)
        if (tail.text === '') {
          last?.inlines.pop()
        }
        movedSpace = tail.classes
      } else if (movedSpace !== null && inline.kind !== 'note') {
        // A label opens the next verse, so the space closes the note's verse instead.
        if (inline.kind === 'label') {
          last?.inlines.push({ kind: 'text', text: ' ', classes: movedSpace })
        } else if (!inline.text.startsWith(' ')) {
          inline = { ...inline, text: ` ${inline.text}` }
        }
        movedSpace = null
      }
      if (last !== undefined && last.verse === verse) {
        last.inlines.push(inline)
      } else {
        segments.push({ verse, inlines: [inline] })
      }
    }

    const visit = (node: Node, verse: number | null, chars: readonly string[]): void => {
      if (node.nodeType === 3) {
        const text = (node.textContent ?? '').replace(/[ \t\n\r]+/g, ' ')
        if (text !== '') {
          push(verse, { kind: 'text', text, classes: chars })
        }
        return
      }
      if (node.nodeType !== 1) {
        return
      }
      // SAFETY: nodeType 1 is ELEMENT_NODE.
      const child = node as Element
      const noteHtml = child.getAttribute('data-verse-footnote-content')
      if (noteHtml !== null) {
        push(verse, { kind: 'note', html: noteHtml })
        return
      }
      const childClasses = classList(child)
      if (childClasses.some((c) => HIDDEN.has(c))) {
        return
      }
      if (childClasses.includes('yv-vlbl')) {
        push(verse, { kind: 'label', text: (child.textContent ?? '').trim() })
        return
      }
      let nextVerse = verse
      if (childClasses.includes('yv-v')) {
        const v = Number(child.getAttribute('v'))
        nextVerse = Number.isInteger(v) && v > 0 ? v : verse
        carried = nextVerse
      }
      const nextChars = childClasses.length > 0 ? [...chars, ...childClasses] : chars
      for (const grandchild of Array.from(child.childNodes)) {
        visit(grandchild, nextVerse, nextChars)
      }
    }

    const blockVerse = heading ? null : carried
    for (const child of Array.from(el.childNodes)) {
      visit(child, blockVerse, [])
    }
    const verses = [...new Set(segments.flatMap((s) => (s.verse === null ? [] : [s.verse])))]
    blocks.push({ classes, heading, segments, verses })
  }
  return blocks
}

function classList(el: Element): string[] {
  return (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => c !== '')
}

function isHeadingClass(classes: readonly string[]): boolean {
  return classes.some((c) => /^(s\d?|ms\d?|mr|r|d|qa|sp)$/.test(c))
}

/** Per verse: share text, footnote-sheet HTML, and notes, across every fragment in order. */
export function collectVerses(blocks: readonly Block[]): Map<number, VerseInfo> {
  const fragments = new Map<number, Inline[][]>()
  for (const block of blocks) {
    if (block.heading) {
      continue
    }
    for (const segment of block.segments) {
      if (segment.verse === null) {
        continue
      }
      const list = fragments.get(segment.verse) ?? []
      list.push(segment.inlines)
      fragments.set(segment.verse, list)
    }
  }
  const verses = new Map<number, VerseInfo>()
  for (const [verse, list] of fragments) {
    const notes: string[] = []
    const texts: string[] = []
    const htmls: string[] = []
    for (const inlines of list) {
      let text = ''
      let html = ''
      for (const inline of inlines) {
        if (inline.kind === 'text') {
          text += inline.text
          html += classedSpan(inline.text, inline.classes)
        } else if (inline.kind === 'note') {
          html += `<sup class="yv:text-muted-foreground">${footnoteMarker(notes.length)}</sup>`
          notes.push(inline.html)
        }
      }
      texts.push(text.trim())
      htmls.push(html.trim())
    }
    verses.set(verse, {
      text: texts.join(' ').replace(/\s+/g, ' ').trim(),
      html: htmls.join(' '),
      notes,
    })
  }
  return verses
}

export type NoteRun = { text: string; classes: readonly string[] }

// USFM styling arrives as classes; these tags carry it in markup instead.
const TAG_CLASS = new Map([
  ['SUP', 'sup'],
  ['B', 'bd'],
  ['STRONG', 'bd'],
  ['I', 'it'],
  ['EM', 'it'],
])

/**
 * Footnote and footnote-sheet verse HTML through the passage walker, one run list per
 * paragraph. Swift breaks a note before each `fp`.
 */
export function parseNoteHtml(html: string): NoteRun[][] {
  const { document } = parseHTML(`<!doctype html><html><body><div>${html}</div></body></html>`)
  const body = document.body
  const source = body.firstElementChild
  if (source === null) {
    return []
  }
  for (const el of Array.from(source.querySelectorAll('sup, b, strong, i, em'))) {
    const extra = TAG_CLASS.get(el.tagName.toUpperCase())
    el.setAttribute('class', [...classList(el), extra].join(' '))
  }
  let paragraph = document.createElement('div')
  body.appendChild(paragraph)
  for (const node of Array.from(source.childNodes)) {
    // SAFETY: nodeType 1 is ELEMENT_NODE.
    if (node.nodeType === 1 && classList(node as Element).includes('fp')) {
      paragraph = document.createElement('div')
      body.appendChild(paragraph)
    }
    paragraph.appendChild(node)
  }
  source.remove()

  return walk(document).flatMap((block) => {
    const runs: NoteRun[] = []
    for (const segment of block.segments) {
      for (const inline of segment.inlines) {
        if (inline.kind !== 'text') {
          continue
        }
        // linkedom splits a text node at each entity.
        const previous = runs.at(-1)
        if (previous !== undefined && previous.classes.join(' ') === inline.classes.join(' ')) {
          previous.text += inline.text
        } else {
          runs.push({ text: inline.text, classes: inline.classes })
        }
      }
    }
    const first = runs[0]
    if (first !== undefined) {
      first.text = first.text.trimStart()
    }
    const last = runs.at(-1)
    if (last !== undefined) {
      last.text = last.text.trimEnd()
    }
    const kept = runs.filter((run) => run.text !== '')
    return kept.length > 0 ? [kept] : []
  })
}

function classedSpan(text: string, all: readonly string[]): string {
  const classes = all.filter((c) => c !== 'yv-v')
  if (classes.length === 0) {
    return escapeHtml(text)
  }
  return `<span class="${classes.join(' ')}">${escapeHtml(text)}</span>`
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Hebrew through Arabic Extended, plus the presentation forms.
const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-﻿]/
const LETTER = /\p{L}/gu

/**
 * The transformer drops the API's direction, and the version body has only `language_tag`
 * (direction sits on the language, an extra request). So the scripture's strong letters vote:
 * a first-letter rule flips ASV Psalm 119, whose `qc` acrostic lines open with Hebrew.
 */
export function isRtlText(blocks: readonly Block[]): boolean {
  // Headings can quote another script, so only scripture votes.
  const texts: string[] = []
  for (const block of blocks) {
    if (block.heading) {
      continue
    }
    for (const segment of block.segments) {
      for (const inline of segment.inlines) {
        if (inline.kind === 'text') {
          texts.push(inline.text)
        }
      }
    }
  }
  return isRtlRuns(texts)
}

/** The same strong-letter vote over plain strings, for footnote sheets that arrive without a direction. */
export function isRtlRuns(texts: Iterable<string>): boolean {
  let rtl = 0
  let ltr = 0
  for (const text of texts) {
    for (const [letter] of text.matchAll(LETTER)) {
      if (RTL_LETTER.test(letter)) {
        rtl += 1
      } else {
        ltr += 1
      }
    }
  }
  return rtl > ltr
}
