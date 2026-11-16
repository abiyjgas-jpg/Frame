import { formatRange, parseRange, type Rect } from '../bindings/range'
import type { BindingType } from '../bindings/types'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type SlideObject, type SlideObjectType } from './types'

export type AddKind = 'chart' | 'table' | 'kpi'

export const BINDING_TYPE: Record<AddKind, BindingType> = { chart: 'range-chart', table: 'range-table', kpi: 'cell-kpi' }

const LIMITS = { chart: { cells: 600 }, table: { rows: 25, cols: 12 } }

/** Why a selection can't become this kind of object, or null if it can. */
export function cannotAdd(kind: AddKind, range: string | null | undefined): string | null {
  if (!range) return 'Select cells in the model first'
  let r: Rect
  try {
    r = parseRange(range)
  } catch {
    return 'Select a block of cells (whole rows or columns are too large)'
  }
  const rows = r.endRow - r.startRow + 1
  const cols = r.endCol - r.startCol + 1
  if (kind === 'kpi' && (rows > 1 || cols > 1)) return 'A KPI shows one cell. Select a single cell'
  if (kind === 'chart' && rows * cols < 2) return 'A chart needs at least two cells'
  if (kind === 'chart' && rows * cols > LIMITS.chart.cells) return `Charts are limited to ${LIMITS.chart.cells} cells`
  if (kind === 'table' && (rows > LIMITS.table.rows || cols > LIMITS.table.cols))
    return `Tables are limited to ${LIMITS.table.rows} rows × ${LIMITS.table.cols} columns`
  return null
}

/** Default on-slide size (logical px) for a new object of this kind and source shape. */
export function defaultSize(kind: AddKind, range: string): { width: number; height: number } {
  const r = parseRange(range)
  if (kind === 'kpi') return { width: 300, height: 140 }
  if (kind === 'chart') return { width: 760, height: 420 }
  const rows = r.endRow - r.startRow + 1
  const cols = r.endCol - r.startCol + 1
  return { width: Math.min(1152, Math.max(320, cols * 150)), height: Math.min(560, rows * 40 + 8) }
}

const MARGIN = 64
const TOP = 136 // leaves room for a slide title
const STEP = 32

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/**
 * Finds the first free spot (reading order) on the slide for a w×h object, shrinking it (down to
 * half size) if it doesn't fit as is. If the slide is full, cascades from the top-left so the new
 * object is still visible and selectable.
 */
export function placeNewObject(existing: Pick<SlideObject, 'x' | 'y' | 'width' | 'height'>[], width: number, height: number) {
  const fullW = Math.min(width, SLIDE_WIDTH - 2 * MARGIN)
  const fullH = Math.min(height, SLIDE_HEIGHT - TOP - 32)
  for (const k of [1, 0.75, 0.5]) {
    const w = Math.round(fullW * k)
    const h = Math.round(fullH * k)
    for (let y = TOP; y + h <= SLIDE_HEIGHT - 32; y += STEP) {
      for (let x = MARGIN; x + w <= SLIDE_WIDTH - MARGIN; x += STEP) {
        const box = { x, y, width: w, height: h }
        if (!existing.some((o) => overlaps(box, o))) return box
      }
    }
  }
  const w = fullW
  const h = fullH
  const n = existing.length % 8
  return { x: MARGIN + n * 24, y: TOP + n * 24, width: w, height: h }
}

let seq = 0
export const newObjectId = (type: SlideObjectType) => `${type}_${Date.now().toString(36)}${(seq++).toString(36)}`

/** The source range as Frame writes it: normalised A1 (e.g. "b3:a1" → "A1:B3"). */
export const normaliseRange = (range: string) => formatRange(parseRange(range))

/**
 * A KPI's label, read the way a practitioner reads the model: the line item to its left and the
 * period above it ("Total · FY28"). `readCell(row, col)` returns the sheet's displayed text.
 */
export function kpiLabelFor(cell: string, readCell: (row: number, col: number) => string, fallback: string): string {
  const r = parseRange(cell)
  const isLabel = (t: string) => t.trim() !== '' && !Number.isFinite(Number(t.replace(/[,%$€£]/g, '')))
  let rowLabel = ''
  for (let c = r.startCol - 1; c >= Math.max(0, r.startCol - 10) && !rowLabel; c--) {
    const t = readCell(r.startRow, c)
    if (isLabel(t)) rowLabel = t
  }
  let colLabel = ''
  for (let row = r.startRow - 1; row >= Math.max(0, r.startRow - 10) && !colLabel; row--) {
    const t = readCell(row, r.startCol)
    if (isLabel(t)) colLabel = t
  }
  return [rowLabel, colLabel].filter(Boolean).join(' · ') || fallback
}
