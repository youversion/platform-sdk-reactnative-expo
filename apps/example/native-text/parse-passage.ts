// POC: run platform-core's own transformer under linkedom, then flatten the
// transformed DOM into blocks of verse-tagged inline runs for <Text> to draw.
import { transformBibleHtml } from '@youversion/platform-core'
import { parseHTML } from 'linkedom'

export type Inline =
  | { kind: 'text'; text: string; classes: readonly string[] }
  | { kind: 'label'; text: string }
  | { kind: 'note'; html: string }

export type Segment = { verse: number | null; inlines: Inline[] }

export type Block = { classes: readonly string[]; heading: boolean; segments: Segment[] }

export type ParsedPassage = {
  blocks: Block[]
  transformMs: number
  walkMs: number
}

const HIDDEN = new Set(['x', 'yv-n'])

export function parsePassage(rawHtml: string): ParsedPassage {
  let captured: Document | null = null
  const t0 = performance.now()
  // Keep the transformed Document instead of serializing and reparsing it.
  transformBibleHtml(rawHtml, {
    parseHtml: (html) => parseHTML(`<!doctype html><html><body>${html}</body></html>`).document,
    serializeHtml: (doc) => {
      captured = doc
      return ''
    },
  })
  const t1 = performance.now()
  const blocks = captured === null ? [] : walk(captured)
  return { blocks, transformMs: t1 - t0, walkMs: performance.now() - t1 }
}

function walk(doc: Document): Block[] {
  const root = doc.querySelector('[data-yv-transformed]') ?? doc.body
  const blocks: Block[] = []
  // Continuation lines (q2 after q1) sit outside any .yv-v; they belong to the last verse.
  let carried: number | null = null

  for (const el of Array.from(root.children)) {
    const classes = classList(el)
    const heading = classes.includes('yv-h') || isHeadingClass(classes)
    const block: Block = { classes, heading, segments: [] }
    const push = (verse: number | null, inline: Inline): void => {
      const last = block.segments.at(-1)
      if (last !== undefined && last.verse === verse) {
        last.inlines.push(inline)
      } else {
        block.segments.push({ verse, inlines: [inline] })
      }
    }

    const visit = (node: Node, verse: number | null, chars: readonly string[]): void => {
      if (node.nodeType === 3) {
        const text = node.textContent ?? ''
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
        nextVerse = Number.isFinite(v) ? v : verse
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
    blocks.push(block)
  }
  return blocks
}

function classList(el: Element): string[] {
  return (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => c !== '')
}

function isHeadingClass(classes: readonly string[]): boolean {
  return classes.some((c) => /^(s\d?|ms\d?|mr|r|d|qa|sp|cl)$/.test(c))
}

/** Footnote bodies are small inline HTML; plain text is enough for the POC panel. */
export function footnoteText(html: string): string {
  return parseHTML(`<!doctype html><html><body>${html}</body></html>`).document.body.textContent ?? ''
}
