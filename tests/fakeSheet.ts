import { parseRange } from '../src/bindings/range'
import type { CellValue, RangeChange, SpreadsheetAdapter } from '../src/spreadsheet/SpreadsheetAdapter'

/** In-memory adapter for testing Frame logic without Univer. */
export class FakeSheet implements SpreadsheetAdapter {
  cells = new Map<string, CellValue>() // key: sheetId!row,col
  listeners = new Set<(c: RangeChange[]) => void>()
  reads = 0

  set(sheetId: string, row: number, col: number, v: CellValue) {
    this.cells.set(`${sheetId}!${row},${col}`, v)
  }
  fire(changes: RangeChange[]) {
    this.listeners.forEach((l) => l(changes))
  }
  getCellValue(sheetId: string, cell: string) {
    return this.getRangeValues(sheetId, cell)[0][0]
  }
  getRangeValues(sheetId: string, range: string) {
    this.reads++
    if (sheetId === 'missing') throw new Error('no sheet')
    const r = parseRange(range)
    const out: CellValue[][] = []
    for (let i = r.startRow; i <= r.endRow; i++) {
      const row: CellValue[] = []
      for (let j = r.startCol; j <= r.endCol; j++) row.push(this.cells.get(`${sheetId}!${i},${j}`) ?? null)
      out.push(row)
    }
    return out
  }
  subscribeToChanges(l: (c: RangeChange[]) => void) {
    this.listeners.add(l)
    return () => void this.listeners.delete(l)
  }
  getSheets() { return [{ id: 's1', name: 'Sheet1' }] }
  getSelection() { return null }
  activateSheet() {}
  selectRange() {}
  saveSnapshot() { return {} }
  loadSnapshot() {}
  dispose() {}
}
