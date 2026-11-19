import type { Block } from './parse-passage'

export type TableRow = { row: number; cells: (number | null)[] }

export type PassageRun =
  | { kind: 'block'; index: number }
  | { kind: 'table'; id: number; rows: TableRow[] }

/**
 * Groups each table's cell blocks into rows. Short rows are padded with null to the
 * widest row (Swift's "fill it out"): USFM rows may skip cells and the API HTML drops spans.
 */
export function passageRuns(blocks: readonly Block[]): PassageRun[] {
  const runs: PassageRun[] = []
  blocks.forEach((block, index) => {
    const slot = block.table
    if (slot === undefined) {
      runs.push({ kind: 'block', index })
      return
    }
    let run = runs.at(-1)
    if (run?.kind !== 'table' || run.id !== slot.id) {
      run = { kind: 'table', id: slot.id, rows: [] }
      runs.push(run)
    }
    let row = run.rows.at(-1)
    if (row?.row !== slot.row) {
      row = { row: slot.row, cells: [] }
      run.rows.push(row)
    }
    row.cells[slot.col] = index
  })
  for (const run of runs) {
    if (run.kind !== 'table') {
      continue
    }
    // A verse embed may slice cells away, so take the widest of what remains too.
    const columns = Math.max(
      ...run.rows.flatMap((row) =>
        row.cells.flatMap((cell) => (cell == null ? [] : [blocks[cell]?.table?.columns ?? 0])),
      ),
      ...run.rows.map((row) => row.cells.length),
    )
    for (const row of run.rows) {
      row.cells = Array.from({ length: columns }, (_, col) => row.cells[col] ?? null)
    }
  }
  return runs
}
