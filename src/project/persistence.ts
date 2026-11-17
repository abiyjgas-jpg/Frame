import { deserializeProject, serializeProject, type FrameProject } from './FrameProject'

/**
 * The browser keeps a copy of the open project (the "workspace") so a reload, crash or closed tab
 * never loses work. Project files on disk (fileAccess.ts) are what users save, open and share;
 * this copy is only for picking up where they left off.
 */
const KEY = 'frame.workspace'
/** Where the shell-stage builds kept their single saved project. Read once, then dropped. */
const LEGACY_KEY = 'frame.project'

export interface WorkspaceState {
  project: FrameProject
  /** True when there are changes not yet written to a project file. */
  dirty: boolean
  /** Name of the file the project was last saved to or opened from, if any. */
  fileName: string | null
}

export function saveWorkspace(s: WorkspaceState, storage: Storage = localStorage): number {
  const json = serializeProject(s.project)
  storage.setItem(KEY, JSON.stringify({ dirty: s.dirty, fileName: s.fileName, project: json }))
  return json.length
}

export function loadWorkspace(storage: Storage = localStorage): WorkspaceState | null {
  try {
    const raw = storage.getItem(KEY)
    if (raw) {
      const w = JSON.parse(raw)
      return { project: deserializeProject(w.project), dirty: !!w.dirty, fileName: typeof w.fileName === 'string' ? w.fileName : null }
    }
    const legacy = storage.getItem(LEGACY_KEY)
    if (legacy) return { project: deserializeProject(legacy), dirty: false, fileName: null }
  } catch (e) {
    console.warn('Ignoring unreadable workspace', e)
  }
  return null
}

export function clearWorkspace(storage: Storage = localStorage) {
  storage.removeItem(KEY)
  storage.removeItem(LEGACY_KEY)
}
