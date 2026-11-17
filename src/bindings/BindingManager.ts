import type { CellValue, RangeChange, SpreadsheetAdapter } from '../spreadsheet/SpreadsheetAdapter'
import { intersects, parseRange, REF_ERROR, shiftRange, type Rect, type StructureChange } from './range'
import type { Binding, BindingType } from './types'

/** A binding's current source data: raw values (for charts) and formatted text (for KPIs and tables). */
export interface ResolvedRange {
  values: CellValue[][]
  display: string[][]
}

export type BindingValues = Map<string, ResolvedRange>
type Listener = (values: BindingValues) => void

let counter = 0
/** A binding's source rectangle, or null if its cells were deleted. */
const sourceRect = (b: Binding): Rect | null => (b.source.range === REF_ERROR ? null : parseRange(b.source.range))

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
  private unsubscribeStructure: (() => void) | null = null
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
    this.unsubscribeStructure?.()
    this.unsubscribeStructure = sheet.subscribeToStructure((c) => this.onStructure(c))
    this.refresh([...this.bindings.keys()])
  }

  detach() {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.unsubscribeStructure?.()
    this.unsubscribeStructure = null
  }

  create(type: BindingType, source: Binding['source'], target: Binding['target'], id = newId()): Binding {
    // Validate. A copy of an object whose cells were deleted keeps the #REF! source.
    if (source.range !== REF_ERROR) parseRange(source.range)
    if (type === 'cell-kpi' && source.range !== REF_ERROR) {
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
      const src = sourceRect(b)
      if (!src) continue
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
    return this.list().filter((b) => {
      const src = b.source.sheetId === sheetId && sourceRect(b)
      return !!src && intersects(r, src)
    })
  }

  /**
   * Rows or columns were inserted or removed: move binding sources with their cells, as a formula's
   * references would move. Returns the ids of bindings whose source changed.
   */
  applyStructureChange(change: StructureChange): string[] {
    const moved: string[] = []
    for (const b of this.bindings.values()) {
      if (b.source.sheetId !== change.sheetId) continue
      const range = shiftRange(b.source.range, change)
      if (range !== b.source.range) {
        this.bindings.set(b.id, { ...b, source: { ...b.source, range } })
        moved.push(b.id)
      }
    }
    return moved
  }

  private onStructure(change: StructureChange) {
    const moved = this.applyStructureChange(change)
    if (moved.length) {
      this.refresh(moved)
      for (const l of this.structureListeners) l(moved)
    }
  }

  private structureListeners = new Set<(ids: string[]) => void>()
  /** Called with binding ids whose source moved because rows or columns were inserted or removed. */
  onSourcesMoved(l: (ids: string[]) => void) {
    this.structureListeners.add(l)
    return () => void this.structureListeners.delete(l)
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
      let next: ResolvedRange
      try {
        if (b.source.range === REF_ERROR) throw new Error('source deleted')
        next = {
          values: this.sheet.getRangeValues(b.source.sheetId, b.source.range),
          display: this.sheet.getRangeDisplayValues(b.source.sheetId, b.source.range),
        }
      } catch {
        next = { values: [], display: [] } // source sheet or cells missing: render empty rather than crash
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
