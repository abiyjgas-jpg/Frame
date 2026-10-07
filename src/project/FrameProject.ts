import type { Binding } from '../bindings/types'

export const FRAME_PROJECT_VERSION = 1

/** Spike subset of the Frame document. Slides/assets arrive in Days 4+. */
export interface FrameProject {
  version: number
  metadata: { name: string; savedAt?: string }
  /** Univer workbook snapshot (IWorkbookData), stored as-is. Holds sheets, values, formulas, styles. */
  workbook: unknown
  slides: unknown[]
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
  return {
    version: raw.version,
    metadata: { name: String(raw.metadata?.name ?? 'Untitled'), savedAt: raw.metadata?.savedAt },
    workbook: raw.workbook,
    slides: Array.isArray(raw.slides) ? raw.slides : [],
    bindings: raw.bindings,
    assets: Array.isArray(raw.assets) ? raw.assets : [],
  }
}
