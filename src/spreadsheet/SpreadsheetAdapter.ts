/**
 * The only spreadsheet surface the rest of Frame may use.
 * Ranges are A1 strings scoped to a sheet id; values are plain JS scalars.
 */
export type CellValue = string | number | boolean | null

export interface RangeChange {
  sheetId: string
  /** A1 ranges that changed. Empty means "something on this sheet changed, extent unknown" (e.g. formula results). */
  ranges: string[]
}

export interface SheetInfo {
  id: string
  name: string
}

export interface SpreadsheetAdapter {
  getCellValue(sheetId: string, cell: string): CellValue
  getRangeValues(sheetId: string, range: string): CellValue[][]
  /** Called after edits and after formula recalculation has been applied. Returns an unsubscribe fn. */
  subscribeToChanges(listener: (changes: RangeChange[]) => void): () => void
  getSheets(): SheetInfo[]
  getSelection(): { sheetId: string; range: string } | null
  activateSheet(sheetId: string): void
  selectRange(sheetId: string, range: string): void
  saveSnapshot(): unknown
  loadSnapshot(snapshot: unknown): void
  dispose(): void
}
