import { beforeEach, describe, expect, it } from 'vitest'
import { BindingManager } from '../src/bindings/BindingManager'
import { FakeSheet } from './fakeSheet'

const target = { slideId: 'slide_1', objectId: 'obj_1' }
const sync = (fn: () => void) => fn()

describe('BindingManager', () => {
  let sheet: FakeSheet
  let m: BindingManager
  beforeEach(() => {
    sheet = new FakeSheet()
    sheet.set('s1', 0, 0, 100)
    sheet.set('s1', 1, 0, 200)
    sheet.set('s1', 2, 0, 300)
    m = new BindingManager(sheet, sync)
    m.attach()
  })

  it('creates a binding and resolves its values immediately', () => {
    const b = m.create('range-chart', { sheetId: 's1', range: 'A1:A3' }, target)
    expect(m.list()).toEqual([b])
    expect(m.getValues(b.id)?.values).toEqual([[100], [200], [300]])
    expect(m.getValues(b.id)?.display).toEqual([['100'], ['200'], ['300']])
  })

  it('rejects invalid ranges and multi-cell KPIs', () => {
    expect(() => m.create('range-chart', { sheetId: 's1', range: 'nope' }, target)).toThrow()
    expect(() => m.create('cell-kpi', { sheetId: 's1', range: 'A1:A2' }, target)).toThrow(/single cell/)
    expect(m.list()).toHaveLength(0)
  })

  it('deletes a binding and its values', () => {
    const b = m.create('cell-kpi', { sheetId: 's1', range: 'A1' }, target)
    expect(m.delete(b.id)).toBe(true)
    expect(m.list()).toHaveLength(0)
    expect(m.getValues(b.id)).toBeUndefined()
    expect(m.delete(b.id)).toBe(false)
  })

  it('updates linked objects when an intersecting range changes', () => {
    const b = m.create('range-chart', { sheetId: 's1', range: 'A1:A3' }, target)
    const seen: unknown[] = []
    m.subscribe((v) => seen.push(v.get(b.id)?.values))
    sheet.set('s1', 1, 0, 250)
    sheet.fire([{ sheetId: 's1', ranges: ['A2'] }])
    expect(m.getValues(b.id)?.values).toEqual([[100], [250], [300]])
    expect(seen.at(-1)).toEqual([[100], [250], [300]])
  })

  it('ignores changes outside the source range or on other sheets', () => {
    const b = m.create('range-chart', { sheetId: 's1', range: 'A1:A3' }, target)
    const before = sheet.reads
    sheet.fire([{ sheetId: 's1', ranges: ['B1:B9'] }])
    sheet.fire([{ sheetId: 's2', ranges: ['A1'] }])
    expect(sheet.reads).toBe(before)
    expect(m.affectedBy([{ sheetId: 's1', ranges: ['A4'] }])).toEqual([])
    expect(m.affectedBy([{ sheetId: 's1', ranges: ['A3:C9'] }])).toEqual([b.id])
  })

  it('treats a whole-sheet change (formula recalculation) as affecting every binding on that sheet', () => {
    const a = m.create('cell-kpi', { sheetId: 's1', range: 'A3' }, target)
    const other = m.create('cell-kpi', { sheetId: 's2', range: 'A1' }, target)
    expect(m.affectedBy([{ sheetId: 's1', ranges: [] }])).toEqual([a.id])
    expect(m.affectedBy([{ sheetId: 's1', ranges: [] }])).not.toContain(other.id)
  })

  it('does not notify when values are unchanged', () => {
    m.create('cell-kpi', { sheetId: 's1', range: 'A1' }, target)
    let n = 0
    m.subscribe(() => n++)
    n = 0
    sheet.fire([{ sheetId: 's1', ranges: ['A1'] }])
    expect(n).toBe(0)
  })

  it('coalesces bursts of changes into one refresh per scheduled frame', () => {
    const queue: (() => void)[] = []
    const mm = new BindingManager(sheet, (fn) => queue.push(fn))
    mm.attach()
    mm.create('range-chart', { sheetId: 's1', range: 'A1:A3' }, target)
    for (let i = 0; i < 10; i++) sheet.fire([{ sheetId: 's1', ranges: ['A1'] }])
    expect(queue).toHaveLength(1)
  })

  it('renders an empty value when the source sheet is missing', () => {
    const b = m.create('range-chart', { sheetId: 'missing', range: 'A1' }, target)
    expect(m.getValues(b.id)?.values).toEqual([])
  })

  it('reports which bindings read a selected range', () => {
    const b = m.create('range-chart', { sheetId: 's1', range: 'A1:A3' }, target)
    expect(m.bindingsForRange('s1', 'A2').map((x) => x.id)).toEqual([b.id])
    expect(m.bindingsForRange('s1', 'B2')).toEqual([])
  })

  it('stops listening after detach', () => {
    const b = m.create('cell-kpi', { sheetId: 's1', range: 'A1' }, target)
    m.detach()
    sheet.set('s1', 0, 0, 1)
    sheet.fire([{ sheetId: 's1', ranges: ['A1'] }])
    expect(m.getValues(b.id)?.values).toEqual([[100]])
  })
})

describe('BindingManager: rows and columns inserted or removed', () => {
  it('moves sources with their cells, re-reads them, and reports which moved', async () => {
    const sheet = new FakeSheet()
    const m = new BindingManager(sheet, (fn) => fn())
    m.attach()
    sheet.set('s1', 2, 0, 42)
    const kpi = m.create('cell-kpi', { sheetId: 's1', range: 'A2' }, { slideId: 'sl', objectId: 'k' })
    const other = m.create('range-chart', { sheetId: 's2', range: 'A1:A3' }, { slideId: 'sl', objectId: 'c' })
    const moved: string[][] = []
    m.onSourcesMoved((ids) => moved.push(ids))

    // A row is inserted above: the value now lives in A3.
    sheet.structureListeners.forEach((l) => l({ sheetId: 's1', axis: 'row', kind: 'insert', start: 0, count: 1 }))
    expect(m.list().find((b) => b.id === kpi.id)!.source.range).toBe('A3')
    expect(m.list().find((b) => b.id === other.id)!.source.range).toBe('A1:A3')
    expect(m.getValues(kpi.id)!.values).toEqual([[42]])
    expect(moved).toEqual([[kpi.id]])

    // Its row is deleted: #REF!, empty values, and nothing throws when looking it up.
    sheet.structureListeners.forEach((l) => l({ sheetId: 's1', axis: 'row', kind: 'remove', start: 2, count: 1 }))
    expect(m.list().find((b) => b.id === kpi.id)!.source.range).toBe('#REF!')
    expect(m.getValues(kpi.id)).toEqual({ values: [], display: [] })
    expect(m.bindingsForRange('s1', 'A1:Z99')).toEqual([])
    expect(m.affectedBy([{ sheetId: 's1', ranges: [] }])).toEqual([])
    // A copy of a deleted-source object can still be made.
    expect(() => m.create('cell-kpi', { sheetId: 's1', range: '#REF!' }, { slideId: 'sl', objectId: 'k2' })).not.toThrow()
  })
})
