import { footnoteMarker, parseFootnoteHtml } from '../footnote-html'

describe('footnoteMarker', () => {
  it('counts a, z, then aa', () => {
    expect(footnoteMarker(0)).toBe('a')
    expect(footnoteMarker(1)).toBe('b')
    expect(footnoteMarker(25)).toBe('z')
    expect(footnoteMarker(26)).toBe('aa')
  })
})

describe('parseFootnoteHtml', () => {
  it('reads an alternate-translation note as bold locator, plain text, and italic', () => {
    expect(
      parseFootnoteHtml(
        '<span class="fr">1:5 </span><span class="ft">Or </span><span class="fqa">understood</span>',
      ),
    ).toEqual([
      {
        runs: [
          {
            text: '1:5 ',
            italic: false,
            weight: 700,
            sup: false,
            wj: false,
            smallCaps: false,
          },
          {
            text: 'Or ',
            italic: false,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
          {
            text: 'understood',
            italic: true,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
        ],
      },
    ])
  })

  it('splits a footnote paragraph and italicizes keyword and label', () => {
    expect(
      parseFootnoteHtml(
        '<span class="ft">First paragraph.</span><span class="fp"><span class="fk">Keyword</span> and <span class="fl">label</span>.</span>',
      ),
    ).toEqual([
      {
        runs: [
          {
            text: 'First paragraph.',
            italic: false,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
        ],
      },
      {
        runs: [
          {
            text: 'Keyword',
            italic: true,
            weight: 500,
            sup: false,
            wj: false,
            smallCaps: false,
          },
          {
            text: ' and ',
            italic: false,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
          {
            text: 'label',
            italic: true,
            weight: 500,
            sup: false,
            wj: false,
            smallCaps: false,
          },
          {
            text: '.',
            italic: false,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
        ],
      },
    ])
  })

  it('keeps words of Jesus, small caps, and a superscript marker in verse html', () => {
    expect(
      parseFootnoteHtml(
        'He then added, <span class="wj">"Very truly I tell you,"</span> <span class="nd">LORD</span><sup class="yv:text-muted-foreground">a</sup>',
      ),
    ).toEqual([
      {
        runs: [
          {
            text: 'He then added, ',
            italic: false,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
          {
            text: '"Very truly I tell you,"',
            italic: false,
            weight: 400,
            sup: false,
            wj: true,
            smallCaps: false,
          },
          {
            text: ' ',
            italic: false,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
          {
            text: 'LORD',
            italic: false,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: true,
          },
          {
            text: 'a',
            italic: false,
            weight: 400,
            sup: true,
            wj: false,
            smallCaps: false,
          },
        ],
      },
    ])
  })

  it('decodes entities, unwraps links, and drops script text', () => {
    expect(
      parseFootnoteHtml(
        '<span class="ft">God&#39;s <a href="https://example.com">Gen. 28:12</a></span><script>alert(1)</script>',
      ),
    ).toEqual([
      {
        runs: [
          {
            text: "God's Gen. 28:12",
            italic: false,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
        ],
      },
    ])
  })

  it('turns a paragraph and a line break into separate blocks', () => {
    expect(parseFootnoteHtml('<p>footnote</p>')).toEqual([
      {
        runs: [
          {
            text: 'footnote',
            italic: false,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
        ],
      },
    ])
    expect(parseFootnoteHtml('Line one<br>Line two')).toEqual([
      {
        runs: [
          {
            text: 'Line one',
            italic: false,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
        ],
      },
      {
        runs: [
          {
            text: 'Line two',
            italic: false,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
        ],
      },
    ])
  })

  it('italicizes a transliteration', () => {
    expect(parseFootnoteHtml('<span class="tl">hoi Ioudaioi</span>')).toEqual([
      {
        runs: [
          {
            text: 'hoi Ioudaioi',
            italic: true,
            weight: 400,
            sup: false,
            wj: false,
            smallCaps: false,
          },
        ],
      },
    ])
  })

  it('returns no paragraphs for empty html', () => {
    expect(parseFootnoteHtml('')).toEqual([])
    expect(parseFootnoteHtml('   ')).toEqual([])
  })
})
