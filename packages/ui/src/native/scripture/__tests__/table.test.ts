import { parsePassage } from '../parse-passage'
import { passageRuns } from '../table'

describe('passageRuns', () => {
  it('groups a table and pads short rows with empty cells', () => {
    const { blocks } = parsePassage(
      '<div><div class="p">Intro</div>' +
        '<table><tr><td>a</td><td>1</td><td>x</td></tr><tr><td>b</td></tr><tr></tr><tr><td>c</td><td>2</td></tr></table>' +
        '<div class="p">After</div></div>',
    )
    expect(passageRuns(blocks)).toEqual([
      { kind: 'block', index: 0 },
      {
        kind: 'table',
        id: 0,
        rows: [
          { row: 0, cells: [1, 2, 3] },
          { row: 1, cells: [4, null, null] },
          { row: 2, cells: [5, 6, null] },
        ],
      },
      { kind: 'block', index: 7 },
    ])
  })

  it('keeps two adjacent tables apart', () => {
    const { blocks } = parsePassage(
      '<div><table><tr><td>a</td></tr></table><table><tr><td>b</td></tr></table></div>',
    )
    expect(passageRuns(blocks).map((run) => (run.kind === 'table' ? run.id : null))).toEqual([0, 1])
  })
})
