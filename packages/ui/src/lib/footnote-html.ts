export type FootnoteRun = {
  text: string
  italic: boolean
  weight: 400 | 500 | 700
  sup: boolean
  wj: boolean
  smallCaps: boolean
}

export type FootnoteParagraph = {
  runs: FootnoteRun[]
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

const PLAIN: FootnoteRun = {
  text: '',
  italic: false,
  weight: 400,
  sup: false,
  wj: false,
  smallCaps: false,
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
  classes: string
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
    if (isBlock(tag.name, tag.classes)) {
      flush()
    }
    if (tag.selfClosing) {
      return
    }
    const drop = tag.name === 'script' || tag.name === 'style'
    frames.push({ name: tag.name, block: isBlock(tag.name, tag.classes), drop })
    if (!drop) {
      styles.push(applyStyle(currentStyle(), tag.name, tag.classes))
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
    const collapsed = decodeEntities(token).replace(/[ \t\n\r\f]+/g, ' ')
    if (collapsed.length === 0) {
      return
    }
    const style = currentStyle()
    const previous = runs[runs.length - 1]
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
    italic: PLAIN.italic,
    weight: PLAIN.weight,
    sup: PLAIN.sup,
    wj: PLAIN.wj,
    smallCaps: PLAIN.smallCaps,
  }
}

function isBlock(name: string, classes: string): boolean {
  if (BLOCK_TAGS.has(name)) {
    return true
  }
  return classTokens(classes).includes('fp')
}

function classTokens(classes: string): string[] {
  if (classes.length === 0) {
    return []
  }
  return classes.split(/\s+/).filter((token) => token.length > 0)
}

function applyStyle(parent: FootnoteStyle, name: string, classes: string): FootnoteStyle {
  const next: FootnoteStyle = { ...parent }
  if (name === 'i' || name === 'em') {
    next.italic = true
  }
  if (name === 'b' || name === 'strong') {
    next.weight = 700
  }
  if (name === 'sup' || name === 'sub') {
    next.sup = true
  }
  for (const token of classTokens(classes)) {
    if (token === 'fq' || token === 'fqa' || token === 'tl' || token === 'em') {
      next.italic = true
    }
    if (token === 'fk' || token === 'fl') {
      next.italic = true
      if (next.weight === 400) {
        next.weight = 500
      }
    }
    if (token === 'bd' || token === 'fr') {
      next.weight = 700
    }
    if (token === 'wj') {
      next.wj = true
    }
    if (token === 'nd' || token === 'sc') {
      next.smallCaps = true
    }
  }
  return next
}

function sameStyle(run: FootnoteRun, style: FootnoteStyle): boolean {
  return (
    run.italic === style.italic &&
    run.weight === style.weight &&
    run.sup === style.sup &&
    run.wj === style.wj &&
    run.smallCaps === style.smallCaps
  )
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
  const classMatch = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(raw)
  const classes = classMatch?.[1] ?? classMatch?.[2] ?? ''
  const selfClosing = /\/\s*>$/.test(raw) || name === 'br'
  return { kind: 'open', name, classes, selfClosing }
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
