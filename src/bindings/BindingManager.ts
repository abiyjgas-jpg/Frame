import type { CellValue, RangeChange, SpreadsheetAdapter } from '../spreadsheet/SpreadsheetAdapter'
import { intersects, parseRange } from './range'
import type { Binding, BindingType } from './types'

export type BindingValues = Map<string, CellValue[][]>
type Listener = (values: BindingValues) => void

let counter = 0
const newId = () => `binding_${Date.now().toString(36)}_${(counter++).toString(36)}`

/**
 * Owns the bindings and keeps their resolved values in sync with the sheet.
 * Knows nothing about Univer; talks only to SpreadsheetAdapter.
 */
export class BindingManager {
  private bindings = new Map<string, Binding>()
  private values: BindingValues = new Map()
  private listeners = new Set<Listener>()
  private unsubscribe: (() => void) | null = null
  private pending: RangeChange[] = []
  private scheduled = false

  constructor(
    private sheet: SpreadsheetAdapter,
    // Microtask, not rAF: edits and formula results arrive in separate tasks anyway, and waiting for a frame adds up to 16 ms.
    private schedule: (fn: () => void) => void = (fn) => queueMicrotask(fn),
  ) {}

  attach(sheet: SpreadsheetAdapter = this.sheet) {
    this.unsubscribe?.()
    this.sheet = sheet
    this.unsubscribe = sheet.subscribeToChanges((c) => this.onChanges(c))
    this.refresh([...this.bindings.keys()])
  }

  detach() {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  create(type: BindingType, source: Binding['source'], target: Binding['target'], id = newId()): Binding {
    parseRange(source.range) // validate
    if (type === 'cell-kpi') {
      const r = parseRange(source.range)
      if (r.startRow !== r.endRow || r.startCol !== r.endCol) throw new Error('KPI bindings need a single cell')
    }
    const b: Binding = { id, type, source: { ...source }, target: { ...target } }
    this.bindings.set(id, b)
    this.refresh([id])
    return b
  }

  delete(id: string) {
    const existed = this.bindings.delete(id)
    this.values.delete(id)
    if (existed) this.notify()
    return existed
  }

  list(): Binding[] {
    return [...this.bindings.values()]
  }

  load(bindings: Binding[]) {
    this.bindings = new Map(bindings.map((b) => [b.id, { ...b }]))
    this.values = new Map()
    this.refresh([...this.bindings.keys()])
  }

  getValues(id: string) {
    return this.values.get(id)
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    l(this.values)
    return () => void this.listeners.delete(l)
  }

  /** Bindings whose source overlaps the given change. Empty ranges = whole sheet. */
  affectedBy(changes: RangeChange[]): string[] {
    const hit = new Set<string>()
    for (const b of this.bindings.values()) {
      const src = parseRange(b.source.range)
      for (const c of changes) {
        if (c.sheetId !== b.source.sheetId) continue
        if (c.ranges.length === 0 || c.ranges.some((r) => intersects(src, parseRange(r)))) hit.add(b.id)
      }
    }
    return [...hit]
  }

  /** Bindings whose source overlaps a range (used for reverse highlighting later). */
  bindingsForRange(sheetId: string, range: string): Binding[] {
    const r = parseRange(range)
    return this.list().filter((b) => b.source.sheetId === sheetId && intersects(r, parseRange(b.source.range)))
  }

  private onChanges(changes: RangeChange[]) {
    this.pending.push(...changes)
    if (this.scheduled) return
    this.scheduled = true
    this.schedule(() => {
      this.scheduled = false
      const batch = this.pending
      this.pending = []
      this.refresh(this.affectedBy(batch))
    })
  }

  private refresh(ids: string[]) {
    let changed = false
    for (const id of ids) {
      const b = this.bindings.get(id)
      if (!b) continue
      let next: CellValue[][]
      try {
        next = this.sheet.getRangeValues(b.source.sheetId, b.source.range)
      } catch {
        next = [] // source sheet missing: render empty rather than crash
      }
      if (JSON.stringify(next) !== JSON.stringify(this.values.get(id))) {
        this.values.set(id, next)
        changed = true
      }
    }
    if (changed) this.notify()
  }

  private notify() {
    const snapshot = new Map(this.values)
    for (const l of this.listeners) l(snapshot)
  }
}
