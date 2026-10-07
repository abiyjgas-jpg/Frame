import type { Binding } from '../bindings/types'
import type { Slide } from '../presentation/types'

export const FRAME_PROJECT_VERSION = 1

export interface FrameProject {
  version: number
  metadata: { name: string; savedAt?: string }
  /** Univer workbook snapshot (IWorkbookData), stored as-is. Holds sheets, values, formulas, styles. */
  workbook: unknown
  slides: Slide[]
  bindings: Binding[]
  assets: unknown[]
}

export function serializeProject(p: FrameProject): string {
  return JSON.stringify({ ...p, metadata: { ...p.metadata, savedAt: new Date().toISOString() } }, null, 2)
}

export function deserializeProject(json: string): FrameProject {
  let raw: any
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('Not a Frame project: invalid JSON')
  }
  if (!raw || typeof raw !== 'object') throw new Error('Not a Frame project')
  if (raw.version !== FRAME_PROJECT_VERSION) throw new Error(`Unsupported Frame project version ${raw.version}`)
  if (!raw.workbook || typeof raw.workbook !== 'object') throw new Error('Frame project has no workbook')
  if (!Array.isArray(raw.bindings)) throw new Error('Frame project has no bindings array')
  for (const b of raw.bindings) {
    if (!b?.id || !b?.type || !b?.source?.sheetId || !b?.source?.range || !b?.target?.objectId)
      throw new Error(`Invalid binding ${JSON.stringify(b)}`)
  }
  const slides = Array.isArray(raw.slides) ? raw.slides : []
  for (const s of slides) {
    if (!s?.id || !Array.isArray(s.objects)) throw new Error(`Invalid slide ${JSON.stringify(s?.id ?? s)}`)
    for (const o of s.objects) {
      if (!o?.id || !o?.type || [o.x, o.y, o.width, o.height].some((n) => typeof n !== 'number'))
        throw new Error(`Invalid object ${JSON.stringify(o?.id ?? o)} on slide ${s.id}`)
    }
  }
  return {
    version: raw.version,
    metadata: { name: String(raw.metadata?.name ?? 'Untitled'), savedAt: raw.metadata?.savedAt },
    workbook: raw.workbook,
    slides: slides.map((s: any) => ({ title: '', ...s, objects: s.objects.map((o: any) => ({ style: {}, ...o, slideId: s.id })) })),
    bindings: raw.bindings,
    assets: Array.isArray(raw.assets) ? raw.assets : [],
  }
}

/** A blank project: one empty sheet, one empty slide. */
export function createBlankProject(name = 'Untitled'): FrameProject {
  return {
    version: FRAME_PROJECT_VERSION,
    metadata: { name },
    workbook: {
      id: 'workbook',
      name,
      sheetOrder: ['sheet-1'],
      sheets: { 'sheet-1': { id: 'sheet-1', name: 'Sheet1', rowCount: 1000, columnCount: 26, cellData: {} } },
    },
    slides: [{ id: 'slide-1', title: 'Slide 1', objects: [] }],
    bindings: [],
    assets: [],
  }
}
