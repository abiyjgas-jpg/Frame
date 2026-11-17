/** Zero-based, inclusive cell rectangle. */
export interface Rect {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

const CELL = /^\$?([A-Z]{1,3})\$?([1-9][0-9]*)$/

export function colToIndex(col: string): number {
  let n = 0
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export function indexToCol(i: number): string {
  let s = ''
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s
  return s
}

/** Parses "B10", "A1:C3", "$A$1:$C$3" (case-insensitive). Throws on anything else. */
export function parseRange(a1: string): Rect {
  const parts = a1.trim().toUpperCase().split(':')
  if (parts.length < 1 || parts.length > 2) throw new Error(`Invalid range "${a1}"`)
  const cells = parts.map((p) => {
    const m = CELL.exec(p)
    if (!m) throw new Error(`Invalid range "${a1}"`)
    return { row: Number(m[2]) - 1, col: colToIndex(m[1]) }
  })
  const [a, b = a] = cells
  return {
    startRow: Math.min(a.row, b.row),
    startCol: Math.min(a.col, b.col),
    endRow: Math.max(a.row, b.row),
    endCol: Math.max(a.col, b.col),
  }
}

export function formatRange(r: Rect): string {
  const a = `${indexToCol(r.startCol)}${r.startRow + 1}`
  const b = `${indexToCol(r.endCol)}${r.endRow + 1}`
  return a === b ? a : `${a}:${b}`
}

export function intersects(a: Rect, b: Rect): boolean {
  return a.startRow <= b.endRow && b.startRow <= a.endRow && a.startCol <= b.endCol && b.startCol <= a.endCol
}

/** What a binding's source becomes when every cell it read has been deleted (as Excel shows it). */
export const REF_ERROR = '#REF!'

/** Rows or columns inserted or removed in a sheet. `start` is 0-based; inserts go before `start`. */
export interface StructureChange {
  sheetId: string
  axis: 'row' | 'col'
  kind: 'insert' | 'remove'
  start: number
  count: number
}

/**
 * Where a range ends up after rows or columns are inserted or removed, the way a spreadsheet moves
 * a formula's reference: inserting inside the range grows it, removing part of it shrinks it, and
 * removing all of it returns REF_ERROR.
 */
export function shiftRange(range: string, change: StructureChange): string {
  if (range === REF_ERROR) return range
  const r = parseRange(range)
  const [lo, hi] = change.axis === 'row' ? [r.startRow, r.endRow] : [r.startCol, r.endCol]
  let s = lo
  let e = hi
  const { start, count } = change
  if (change.kind === 'insert') {
    if (start <= lo) {
      s += count
      e += count
    } else if (start <= hi) {
      e += count
    }
  } else {
    const end = start + count - 1
    s = lo < start ? lo : lo > end ? lo - count : start
    e = hi < start ? hi : hi > end ? hi - count : start - 1
    if (e < s) return REF_ERROR
  }
  return formatRange(change.axis === 'row' ? { ...r, startRow: s, endRow: e } : { ...r, startCol: s, endCol: e })
}
