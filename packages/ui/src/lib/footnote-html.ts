const LETTERS = 'abcdefghijklmnopqrstuvwxyz'

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
