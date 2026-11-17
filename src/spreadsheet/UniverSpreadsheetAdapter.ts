import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import '@univerjs/preset-sheets-core/lib/index.css'
import type { CellValue, RangeChange, Selection, SheetInfo, SpreadsheetAdapter } from './SpreadsheetAdapter'

type UniverAPI = ReturnType<typeof createUniver>['univerAPI']

/**
 * Every edit is followed by a formula pass (even when nothing depends on the cell), which writes its
 * results as a second change. Holding edits until that pass ends means linked objects update once,
 * with consistent totals, instead of briefly showing a new input next to a stale total.
 * If no pass arrives (e.g. a style-only change), held changes are released after this long.
 */
const MAX_HOLD_MS = 400
/**
 * A user-level command (CommandType.COMMAND) that changes the workbook. Loading a workbook and
 * formula passes only run mutations, so they never count as edits. Navigation commands are excluded.
 */
const COMMAND = 0
const NOT_AN_EDIT = /(select|activate|zoom|scroll)/
const isEditCommand = (id: string) =>
  (id.startsWith('sheet.command.') && !NOT_AN_EDIT.test(id)) || id === 'univer.command.undo' || id === 'univer.command.redo'
type IWorkbookData = Parameters<UniverAPI['createWorkbook']>[0]

/** All Univer-specific code lives in this file. */
export class UniverSpreadsheetAdapter implements SpreadsheetAdapter {
  private univer: ReturnType<typeof createUniver>['univer']
  private api: UniverAPI
  private listeners = new Set<(changes: RangeChange[]) => void>()
  private selectionListeners = new Set<(s: Selection | null) => void>()
  private editListeners = new Set<() => void>()
  private disposables: { dispose(): void }[] = []
  private held: RangeChange[] = []
  private holdTimer: ReturnType<typeof setTimeout> | null = null

  constructor(container: HTMLElement, snapshot: IWorkbookData) {
    const { univer, univerAPI } = createUniver({
      locale: LocaleType.EN_US,
      locales: { [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS) },
      presets: [UniverSheetsCorePreset({ container })],
    })
    this.univer = univer
    this.api = univerAPI
    this.api.createWorkbook(snapshot)

    // User edits, paste, fill, etc.
    this.disposables.push(
      this.api.addEvent(this.api.Event.SheetValueChanged, (p) => {
        const bySheet = new Map<string, string[]>()
        for (const r of p.effectedRanges) {
          const id = r.getSheetId()
          bySheet.set(id, [...(bySheet.get(id) ?? []), r.getA1Notation()])
        }
        this.hold([...bySheet].map(([sheetId, ranges]) => ({ sheetId, ranges })))
      }),
    )
    this.disposables.push(this.api.getFormula().calculationEnd(() => this.release()))
    this.disposables.push(
      // The SelectionChanged facade event does not fire for pointer selection in 1.0.3; the
      // set-selections operation does (mouse, keyboard and selectRange), and survives workbook reloads.
      this.api.addEvent(this.api.Event.CommandExecuted, ({ id, type }) => {
        if (type === COMMAND && isEditCommand(id)) for (const l of this.editListeners) l()
        if (id !== 'sheet.operation.set-selections') return
        const sel = this.getSelection()
        for (const l of this.selectionListeners) l(sel)
      }),
    )
    // Recalculated formula results. Dependants are not reported precisely, so signal "whole sheet".
    this.disposables.push(
      this.api.getFormula().calculationResultApplied((result) => {
        const changes: RangeChange[] = []
        for (const unit of Object.values(result.unitData ?? {})) {
          for (const sheetId of Object.keys(unit ?? {})) changes.push({ sheetId, ranges: [] })
        }
        if (changes.length) this.emit(changes)
      }),
    )
  }

  private hold(changes: RangeChange[]) {
    this.held.push(...changes)
    this.holdTimer ??= setTimeout(() => this.release(), MAX_HOLD_MS)
  }

  private release() {
    if (this.holdTimer) clearTimeout(this.holdTimer)
    this.holdTimer = null
    const changes = this.held
    this.held = []
    if (changes.length) this.emit(changes)
  }

  private emit(changes: RangeChange[]) {
    for (const l of this.listeners) l(changes)
  }

  private wb() {
    const wb = this.api.getActiveWorkbook()
    if (!wb) throw new Error('No active workbook')
    return wb
  }

  private sheet(sheetId: string) {
    const ws = this.wb().getSheetBySheetId(sheetId)
    if (!ws) throw new Error(`Unknown sheet ${sheetId}`)
    return ws
  }

  getCellValue(sheetId: string, cell: string): CellValue {
    return this.getRangeValues(sheetId, cell)[0]?.[0] ?? null
  }

  getRangeValues(sheetId: string, range: string): CellValue[][] {
    return this.sheet(sheetId).getRange(range).getValues() as CellValue[][]
  }

  getRangeDisplayValues(sheetId: string, range: string): string[][] {
    return this.sheet(sheetId).getRange(range).getDisplayValues()
  }

  subscribeToSelection(listener: (s: Selection | null) => void) {
    this.selectionListeners.add(listener)
    return () => void this.selectionListeners.delete(listener)
  }

  subscribeToChanges(listener: (changes: RangeChange[]) => void) {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  subscribeToEdits(listener: () => void) {
    this.editListeners.add(listener)
    return () => void this.editListeners.delete(listener)
  }

  getSheets(): SheetInfo[] {
    return this.wb().getSheets().map((s) => ({ id: s.getSheetId(), name: s.getSheetName() }))
  }

  getSelection(): Selection | null {
    const r = this.api.getActiveWorkbook()?.getActiveRange()
    return r ? { sheetId: r.getSheetId(), range: r.getA1Notation() } : null
  }

  activateSheet(sheetId: string) {
    this.wb().setActiveSheet(sheetId)
  }

  selectRange(sheetId: string, range: string) {
    this.activateSheet(sheetId)
    this.sheet(sheetId).getRange(range).activate()
  }

  saveSnapshot(): unknown {
    return this.wb().save()
  }

  loadSnapshot(snapshot: unknown) {
    const current = this.api.getActiveWorkbook()
    if (current) this.api.disposeUnit(current.getId())
    this.api.createWorkbook(snapshot as IWorkbookData)
  }

  dispose() {
    if (this.holdTimer) clearTimeout(this.holdTimer)
    this.disposables.forEach((d) => d.dispose())
    this.listeners.clear()
    this.selectionListeners.clear()
    this.editListeners.clear()
    this.univer.dispose()
  }
}
