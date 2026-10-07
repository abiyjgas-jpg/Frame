import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import '@univerjs/preset-sheets-core/lib/index.css'
import type { CellValue, RangeChange, SheetInfo, SpreadsheetAdapter } from './SpreadsheetAdapter'

type UniverAPI = ReturnType<typeof createUniver>['univerAPI']
type IWorkbookData = Parameters<UniverAPI['createWorkbook']>[0]

/** All Univer-specific code lives in this file. */
export class UniverSpreadsheetAdapter implements SpreadsheetAdapter {
  private univer: ReturnType<typeof createUniver>['univer']
  private api: UniverAPI
  private listeners = new Set<(changes: RangeChange[]) => void>()
  private disposables: { dispose(): void }[] = []

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
        this.emit([...bySheet].map(([sheetId, ranges]) => ({ sheetId, ranges })))
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

  subscribeToChanges(listener: (changes: RangeChange[]) => void) {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  getSheets(): SheetInfo[] {
    return this.wb().getSheets().map((s) => ({ id: s.getSheetId(), name: s.getSheetName() }))
  }

  getSelection() {
    const r = this.wb().getActiveRange()
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
    this.disposables.forEach((d) => d.dispose())
    this.listeners.clear()
    this.univer.dispose()
  }
}
