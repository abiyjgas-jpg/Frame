import { describe, expect, it } from 'vitest'
import { cannotAdd, defaultSize, kpiLabelFor, normaliseRange, placeNewObject } from '../src/presentation/addToPresentation'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../src/presentation/types'

describe('cannotAdd', () => {
  it('needs a selection', () => {
    expect(cannotAdd('chart', null)).toMatch(/Select cells/)
  })
  it('KPI only for a single cell', () => {
    expect(cannotAdd('kpi', 'C24')).toBeNull()
    expect(cannotAdd('kpi', 'C24:C25')).toMatch(/single cell/)
  })
  it('charts need two or more cells and have an upper bound', () => {
    expect(cannotAdd('chart', 'A1')).toMatch(/two cells/)
    expect(cannotAdd('chart', 'A1:D4')).toBeNull()
    expect(cannotAdd('chart', 'A1:Z100')).toMatch(/limited/)
  })
  it('tables have a row and column limit', () => {
    expect(cannotAdd('table', 'A1')).toBeNull()
    expect(cannotAdd('table', 'A1:L25')).toBeNull()
    expect(cannotAdd('table', 'A1:A26')).toMatch(/limited/)
  })
  it('whole columns or unparseable ranges are refused', () => {
    expect(cannotAdd('chart', 'A:A')).toMatch(/too large/)
  })
})

describe('placement', () => {
  it('first object goes top-left under the title area', () => {
    expect(placeNewObject([], 760, 420)).toEqual({ x: 64, y: 136, width: 760, height: 420 })
  })
  it('never overlaps existing objects when space exists', () => {
    const existing = [{ x: 64, y: 136, width: 300, height: 140 }]
    const p = placeNewObject(existing, 300, 140)
    const o = existing[0]
    expect(p.x >= o.x + o.width || p.y >= o.y + o.height).toBe(true)
  })
  it('shrinks to fit around a title-slide text band rather than overlapping it', () => {
    const band = [{ x: 96, y: 280, width: 1088, height: 152 }]
    const p = placeNewObject(band, 760, 420)
    expect(p.y >= 432 || p.y + p.height <= 280).toBe(true)
    expect(p.width).toBeLessThan(760)
  })
  it('stays on the slide and cascades when the slide is full', () => {
    const full = [{ x: 0, y: 0, width: SLIDE_WIDTH, height: SLIDE_HEIGHT }]
    const p = placeNewObject(full, 760, 420)
    expect(p.x + p.width).toBeLessThanOrEqual(SLIDE_WIDTH)
    expect(p.y + p.height).toBeLessThanOrEqual(SLIDE_HEIGHT)
  })
  it('oversized objects are shrunk to fit', () => {
    const p = placeNewObject([], 5000, 5000)
    expect(p.x + p.width).toBeLessThanOrEqual(SLIDE_WIDTH)
    expect(p.y + p.height).toBeLessThanOrEqual(SLIDE_HEIGHT)
  })
  it('default sizes scale tables with the range', () => {
    expect(defaultSize('table', 'A1:B2').height).toBeLessThan(defaultSize('table', 'A1:B12').height)
    expect(defaultSize('kpi', 'A1')).toEqual({ width: 300, height: 140 })
  })
  it('normalises ranges', () => {
    expect(normaliseRange('d4:a1')).toBe('A1:D4')
    expect(normaliseRange('$B$2')).toBe('B2')
  })
})

describe('kpiLabelFor', () => {
  // C1:F4 = spec model (blank, FY26.., Enterprise.., SMB.., Total..)
  const grid: Record<string, string> = {
    '0,3': 'FY26', '0,4': 'FY27', '0,5': 'FY28',
    '1,2': 'Enterprise', '1,3': '60', '1,4': '70', '1,5': '82',
    '3,2': 'Total', '3,3': '100', '3,4': '115', '3,5': '131',
  }
  const read = (r: number, c: number) => grid[`${r},${c}`] ?? ''
  it('combines the line item and the period', () => {
    expect(kpiLabelFor('F4', read, 'Model!F4')).toBe('Total · FY28')
    expect(kpiLabelFor('D2', read, 'x')).toBe('Enterprise · FY26')
  })
  it('falls back to the address when there are no labels', () => {
    expect(kpiLabelFor('A3', () => '100', 'Model!A3')).toBe('Model!A3')
  })
  it('does not treat formatted numbers as labels', () => {
    expect(kpiLabelFor('B1', (_r, c) => (c === 0 ? '$1,200' : ''), 'fb')).toBe('fb')
  })
})
