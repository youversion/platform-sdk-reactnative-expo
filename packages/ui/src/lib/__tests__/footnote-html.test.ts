import { footnoteMarker, parseFootnoteHtml, type FootnoteRun } from '../footnote-html'

function run(text: string, extras?: Partial<FootnoteRun>): FootnoteRun {
  return { text, weight: 400, sup: false, ...extras }
}

describe('footnoteMarker', () => {
  it('counts a, z, then aa', () => {
    expect(footnoteMarker(0)).toBe('a')
    expect(footnoteMarker(1)).toBe('b')
    expect(footnoteMarker(25)).toBe('z')
    expect(footnoteMarker(26)).toBe('aa')
  })
})

describe('parseFootnoteHtml', () => {
  it('keeps a note as plain text when the markup is only reader classes', () => {
    expect(
      parseFootnoteHtml(
        '<span class="fr">1:5 </span><span class="ft">Or </span><span class="fqa">understood</span>',
      ),
    ).toEqual([{ runs: [run('1:5 Or understood')] }])
  })

  it('bolds a real b tag and leaves the following words plain', () => {
    expect(parseFootnoteHtml('<b>1:5</b> Or understood')).toEqual([
      {
        runs: [run('1:5', { weight: 700 }), run(' Or understood')],
      },
    ])
  })

  it('keeps a keyword note as one paragraph', () => {
    expect(
      parseFootnoteHtml(
        '<span class="ft">First paragraph.</span><span class="fp"><span class="fk">Keyword</span> and <span class="fl">label</span>.</span>',
      ),
    ).toEqual([{ runs: [run('First paragraph.Keyword and label.')] }])
  })

  it('keeps a superscript marker and collapses the space before it', () => {
    expect(
      parseFootnoteHtml(
        'He then added, <span class="wj">"Very truly I tell you,"</span> <span class="nd">LORD</span><sup class="yv:text-muted-foreground">a</sup>',
      ),
    ).toEqual([
      {
        runs: [run('He then added, "Very truly I tell you," LORD'), run('a', { sup: true })],
      },
    ])
  })

  it('collapses a space at the end of one tag and the start of the next', () => {
    expect(parseFootnoteHtml('<span>In the beginning </span> <span>was the Word</span>')).toEqual([
      { runs: [run('In the beginning was the Word')] },
    ])
  })

  it('drops a leading space left by an empty bold tag', () => {
    expect(parseFootnoteHtml('<p><b> </b> text</p>')).toEqual([{ runs: [run('text')] }])
  })

  it('decodes entities, unwraps links, and drops script text', () => {
    expect(
      parseFootnoteHtml(
        '<span class="ft">God&#39;s <a href="https://example.com">Gen. 28:12</a></span><script>alert(1)</script>',
      ),
    ).toEqual([{ runs: [run("God's Gen. 28:12")] }])
  })

  it('turns a paragraph and a line break into separate blocks', () => {
    expect(parseFootnoteHtml('<p>footnote</p>')).toEqual([{ runs: [run('footnote')] }])
    expect(parseFootnoteHtml('Line one<br>Line two')).toEqual([
      { runs: [run('Line one')] },
      { runs: [run('Line two')] },
    ])
  })

  it('leaves a transliteration class as plain text', () => {
    expect(parseFootnoteHtml('<span class="tl">hoi Ioudaioi</span>')).toEqual([
      { runs: [run('hoi Ioudaioi')] },
    ])
  })

  it('returns no paragraphs for empty html', () => {
    expect(parseFootnoteHtml('')).toEqual([])
    expect(parseFootnoteHtml('   ')).toEqual([])
  })
})
