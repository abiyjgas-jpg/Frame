import { formatRange, indexToCol, type Rect } from '../bindings/range'
import type { CellValue } from '../spreadsheet/SpreadsheetAdapter'

export interface ChartSeries {
  name: string
  data: (number | null)[]
}

export interface ChartData {
  labels: string[]
  series: ChartSeries[]
}

const isText = (v: CellValue) => typeof v === 'string' && v.trim() !== '' && !Number.isFinite(Number(v))
const isBlank = (v: CellValue) => v === null || v === ''
const toNumber = (v: CellValue): number | null => {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean' || isBlank(v)) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const label = (v: CellValue, fallback: string) => (isBlank(v) ? fallback : String(v))

/**
 * Detects the practitioner layout: a label column (line items) down the left and a header row
 * (periods) across the top. Each must be all text or blank, with at least one text cell.
 */
export function detectHeaders(grid: CellValue[][]): { headerRow: boolean; labelCol: boolean } {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const textish = (cells: CellValue[]) => cells.length > 0 && cells.every((v) => isText(v) || isBlank(v)) && cells.some(isText)
  // The top-left cell belongs to both, so the label column is judged on the rows below it (if any).
  const labelCol = cols > 1 && textish((rows > 1 ? grid.slice(1) : grid).map((r) => r[0]))
  const top = grid[0].slice(labelCol ? 1 : 0)
  const isYear = (v: CellValue) => typeof v === 'number' && Number.isInteger(v) && v >= 1900 && v <= 2100
  // Years typed as numbers (2026, 2027…) above a label column are a header, not a data row.
  const headerRow = rows > 1 && (textish(top) || (labelCol && (isBlank(grid[0][0]) || isText(grid[0][0])) && top.every(isYear)))
  return { headerRow, labelCol }
}

/**
 * Turns a sheet range into chart series the way a practitioner lays out a model:
 * years across the top, line items down the side, one series per line item.
 * A single row or column becomes one series.
 */
export function rangeToChartData(grid: CellValue[][], rect: Rect): ChartData {
  if (!grid.length || !grid[0]?.length) return { labels: [], series: [] }
  const { headerRow, labelCol } = detectHeaders(grid)
  const r0 = headerRow ? 1 : 0
  const c0 = labelCol ? 1 : 0
  const body = grid.slice(r0).map((r) => r.slice(c0))
  const bodyRows = body.length
  const bodyCols = body[0]?.length ?? 0
  const cellRef = (r: number, c: number) =>
    formatRange({ startRow: rect.startRow + r, startCol: rect.startCol + c, endRow: rect.startRow + r, endCol: rect.startCol + c })

  if (bodyCols === 1 && bodyRows > 1) {
    // One column of numbers going down: categories are the rows.
    return {
      labels: body.map((_, i) => (labelCol ? label(grid[r0 + i][0], cellRef(r0 + i, c0)) : cellRef(r0 + i, c0))),
      series: [{ name: headerRow ? label(grid[0][c0], '') : '', data: body.map((r) => toNumber(r[0])) }],
    }
  }

  const labels = Array.from({ length: bodyCols }, (_, j) =>
    headerRow ? label(grid[0][c0 + j], indexToCol(rect.startCol + c0 + j)) : bodyRows === 1 ? cellRef(r0, c0 + j) : indexToCol(rect.startCol + c0 + j),
  )
  const series = body.map((row, i) => ({
    name: labelCol ? label(grid[r0 + i][0], `Row ${rect.startRow + r0 + i + 1}`) : bodyRows === 1 ? '' : `Row ${rect.startRow + r0 + i + 1}`,
    data: row.map(toNumber),
  }))
  return { labels, series }
}
