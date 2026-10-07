import { deserializeProject, serializeProject, type FrameProject } from './FrameProject'

/**
 * Shell-stage persistence: the browser's localStorage. File System Access API Save/Open
 * with a download/upload fallback replaces this in Days 21–24; callers only see these two functions.
 */
const KEY = 'frame.project'

export function saveToBrowser(p: FrameProject): number {
  const json = serializeProject(p)
  localStorage.setItem(KEY, json)
  return json.length
}

export function loadFromBrowser(): FrameProject | null {
  const json = localStorage.getItem(KEY)
  if (!json) return null
  try {
    return deserializeProject(json)
  } catch (e) {
    console.warn('Ignoring unreadable saved project', e)
    return null
  }
}

export function clearBrowserProject() {
  localStorage.removeItem(KEY)
}
