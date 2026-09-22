export type FootnoteRun = {
  text: string
  weight: 400 | 700
  sup: boolean
}

export type FootnoteParagraph = {
  runs: FootnoteRun[]
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

const PLAIN: FootnoteRun = {
  text: '',
  weight: 400,
  sup: false,
}

type FootnoteStyle = Omit<FootnoteRun, 'text'>

type Frame = {
  name: string
  block: boolean
  drop: boolean
}

type OpenTag = {
  kind: 'open'
  name: string
  selfClosing: boolean
}

type CloseTag = {
  kind: 'close'
  name: string
}

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'br',
  'li',
  'ul',
  'ol',
  'section',
  'table',
  'tr',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
])

/**
 * Footnote letters in the sheet match the markers the web scripture view
 * writes into verseHtml (`a`, `b`, … `z`, `aa`).
 */
export function footnoteMarker(index: number): string {
  const base = LETTERS.length
  let value = index
  let marker = ''
  do {
    const letter = LETTERS[value % base]
    if (letter === undefined) {
      return String(index + 1)
    }
    marker = letter + marker
    value = Math.floor(value / base) - 1
  } while (value >= 0)
  return marker
}

export function parseFootnoteHtml(html: string): FootnoteParagraph[] {
  const paragraphs: FootnoteParagraph[] = []
  const runs: FootnoteRun[] = []
  const frames: Frame[] = []
  const styles: FootnoteStyle[] = [plainStyle()]

  function flush(): void {
    const trimmed = trimRuns(runs)
    runs.length = 0
    if (trimmed.length === 0) {
      return
    }
    paragraphs.push({ runs: trimmed })
  }

  function dropping(): boolean {
    for (const frame of frames) {
      if (frame.drop) {
        return true
      }
    }
    return false
  }

  function currentStyle(): FootnoteStyle {
    return styles[styles.length - 1] ?? plainStyle()
  }

  function openTag(tag: OpenTag): void {
    if (isBlock(tag.name)) {
      flush()
    }
    if (tag.selfClosing) {
      return
    }
    const drop = tag.name === 'script' || tag.name === 'style'
    frames.push({ name: tag.name, block: isBlock(tag.name), drop })
    if (!drop) {
      styles.push(applyStyle(currentStyle(), tag.name))
    }
  }

  function closeTag(name: string): void {
    let index = frames.length - 1
    while (index >= 0) {
      const frame = frames[index]
      if (frame !== undefined && frame.name === name) {
        break
      }
      index -= 1
    }
    if (index < 0) {
      return
    }
    const removed = frames.splice(index)
    for (const frame of removed) {
      if (!frame.drop && styles.length > 1) {
        styles.pop()
      }
      if (frame.block) {
        flush()
      }
    }
  }

  function emitText(token: string): void {
    let collapsed = decodeEntities(token).replace(/[ \t\n\r\f]+/g, ' ')
    if (collapsed.length === 0) {
      return
    }
    const previous = runs[runs.length - 1]
    const previousEndsWithSpace = previous !== undefined && previous.text.endsWith(' ')
    if (collapsed.startsWith(' ') && (previous === undefined || previousEndsWithSpace)) {
      collapsed = collapsed.replace(/^ +/, '')
    }
    if (collapsed.length === 0) {
      return
    }
    const style = currentStyle()
    if (previous !== undefined && sameStyle(previous, style)) {
      previous.text += collapsed
      return
    }
    runs.push({ text: collapsed, ...style })
  }

  const tokens = html.match(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g) ?? []
  for (const token of tokens) {
    if (token.startsWith('<!--')) {
      continue
    }
    if (token.startsWith('<')) {
      const tag = parseTag(token)
      if (tag === null) {
        continue
      }
      if (tag.kind === 'close') {
        closeTag(tag.name)
        continue
      }
      openTag(tag)
      continue
    }
    if (dropping()) {
      continue
    }
    emitText(token)
  }

  flush()
  return paragraphs
}

function plainStyle(): FootnoteStyle {
  return {
    weight: PLAIN.weight,
    sup: PLAIN.sup,
  }
}

function isBlock(name: string): boolean {
  return BLOCK_TAGS.has(name)
}

/**
 * The web footnote sheet does not style bible-reader classes such as fr, fqa, and wj.
 * Its CSS resets every element to the parent font and only restores bold on b and strong,
 * plus the superscript treatment on sup and sub.
 */
function applyStyle(parent: FootnoteStyle, name: string): FootnoteStyle {
  const next: FootnoteStyle = { ...parent }
  if (name === 'b' || name === 'strong') {
    next.weight = 700
  }
  if (name === 'sup' || name === 'sub') {
    next.sup = true
  }
  return next
}

function sameStyle(run: FootnoteRun, style: FootnoteStyle): boolean {
  return run.weight === style.weight && run.sup === style.sup
}

function trimRuns(source: FootnoteRun[]): FootnoteRun[] {
  if (source.length === 0) {
    return []
  }
  const next = source.map((run) => ({ ...run }))
  const first = next[0]
  const last = next[next.length - 1]
  if (first === undefined || last === undefined) {
    return []
  }
  first.text = first.text.replace(/^\s+/, '')
  last.text = last.text.replace(/\s+$/, '')
  return next.filter((run) => run.text.length > 0)
}

function parseTag(raw: string): OpenTag | CloseTag | null {
  const close = /^<\s*\/\s*([a-zA-Z0-9]+)/.exec(raw)
  const closeName = close?.[1]
  if (closeName !== undefined) {
    return { kind: 'close', name: closeName.toLowerCase() }
  }
  const open = /^<\s*([a-zA-Z0-9]+)/.exec(raw)
  const openName = open?.[1]
  if (openName === undefined) {
    return null
  }
  const name = openName.toLowerCase()
  const selfClosing = /\/\s*>$/.test(raw) || name === 'br'
  return { kind: 'open', name, selfClosing }
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/gi, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      return fromCodePoint(Number.parseInt(body.slice(2), 16), match)
    }
    if (body.startsWith('#')) {
      return fromCodePoint(Number.parseInt(body.slice(1), 10), match)
    }
    if (body === 'amp') return '&'
    if (body === 'lt') return '<'
    if (body === 'gt') return '>'
    if (body === 'quot') return '"'
    if (body === 'apos') return "'"
    if (body === 'nbsp') return ' '
    return match
  })
}

function fromCodePoint(code: number, fallback: string): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) {
    return fallback
  }
  return String.fromCodePoint(code)
}
