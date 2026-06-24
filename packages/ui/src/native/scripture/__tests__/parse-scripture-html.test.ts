import { parseScriptureHtml } from '../parse-scripture-html'
import { SAMPLE_PASSAGE_HTML } from '../__fixtures__/sample-passage'
import type { ScriptureElementNode, ScriptureNode } from '../types'

function walk(nodes: ScriptureNode[], visit: (el: ScriptureElementNode) => void): void {
  for (const node of nodes) {
    if (node.type === 'element') {
      visit(node)
      walk(node.children, visit)
    }
  }
}

function collectVerseNumbers(nodes: ScriptureNode[]): string[] {
  const verses: string[] = []
  walk(nodes, (el) => {
    if (el.classes.includes('yv-v') && el.attrs.verseNumber != null) {
      verses.push(el.attrs.verseNumber)
    }
  })
  return verses
}

describe('parseScriptureHtml — raw Acts 15 fixture', () => {
  const nodes = parseScriptureHtml(SAMPLE_PASSAGE_HTML)

  it('returns the outer container div as a single root node', () => {
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({ type: 'element', tag: 'div' })
  })

  it('preserves every verse start marker (v1–v41) with its number', () => {
    const verses = collectVerseNumbers(nodes)
    expect(verses[0]).toBe('1')
    expect(verses).toContain('41')
    expect(verses).toHaveLength(41)
  })

  it('keeps block paragraph and poetry classes', () => {
    const classes = new Set<string>()
    walk(nodes, (el) => el.classes.forEach((c) => classes.add(c)))
    expect(classes).toContain('p')
    expect(classes).toContain('q1')
    expect(classes).toContain('q2')
    expect(classes).toContain('pmo')
    expect(classes).toContain('yv-vlbl')
  })

  it('collapses insignificant whitespace but keeps inter-verse spaces', () => {
    // The space between "...you cannot be saved.” " and the next verse marker
    // must survive so verses do not run together.
    const allText: string[] = []
    walk(nodes, (el) => {
      el.children.forEach((c) => {
        if (c.type === 'text') allText.push(c.text)
      })
    })
    expect(allText.some((t) => t.includes('cannot be saved.” '))).toBe(true)
  })
})

describe('parseScriptureHtml — transformed footnote shape', () => {
  const html =
    '<div class="p"><span class="yv-v" v="2"><span class="yv-vlbl">2 </span>Now the earth was formless<span data-verse-footnote="2" data-verse-footnote-content="&lt;span class=&quot;ft&quot;&gt;Or a wasteland&lt;/span&gt;"></span> and void.</span></div>'
  const nodes = parseScriptureHtml(html)

  it('decodes footnote anchor attributes onto the AST', () => {
    let footnoteKey: string | undefined
    let footnoteContent: string | undefined
    walk(nodes, (el) => {
      if (el.attrs.footnoteKey != null) {
        footnoteKey = el.attrs.footnoteKey
        footnoteContent = el.attrs.footnoteContent
      }
    })
    expect(footnoteKey).toBe('2')
    expect(footnoteContent).toContain('<span class="ft">Or a wasteland</span>')
  })

  it('exposes the wrapped verse number on the .yv-v element', () => {
    expect(collectVerseNumbers(nodes)).toEqual(['2'])
  })
})

describe('parseScriptureHtml — raw .yv-n footnote shape', () => {
  // Raw API footnotes carry their note as child spans with no
  // `data-verse-footnote-content` attribute; the parser captures their inner HTML.
  const html =
    '<div class="p"><span class="yv-v" v="3"></span><span class="yv-vlbl">3</span>Text<span class="yv-n f"><span class="fr">3:1 </span><span class="ft">Or otherwise</span></span> more.</div>'
  const nodes = parseScriptureHtml(html)

  it('captures the raw footnote inner HTML as footnoteContent', () => {
    let footnoteContent: string | undefined
    walk(nodes, (el) => {
      if (el.classes.includes('yv-n')) footnoteContent = el.attrs.footnoteContent
    })
    expect(footnoteContent).toContain('<span class="fr">3:1 </span>')
    expect(footnoteContent).toContain('<span class="ft">Or otherwise</span>')
  })
})

describe('parseScriptureHtml — hidden classes', () => {
  it('drops metadata, chapter labels, and cross-references', () => {
    const html =
      '<div><div class="toc1">Genesis</div><div class="chapter"><span class="label">1</span><div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>Text<span class="x">xref</span>.</div></div></div>'
    const nodes = parseScriptureHtml(html)
    const classes = new Set<string>()
    walk(nodes, (el) => el.classes.forEach((c) => classes.add(c)))
    expect(classes.has('toc1')).toBe(false)
    expect(classes.has('label')).toBe(false)
    expect(classes.has('x')).toBe(false)
    expect(classes.has('p')).toBe(true)
  })
})
