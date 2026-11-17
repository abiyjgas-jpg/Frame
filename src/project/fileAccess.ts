/**
 * Project files on the user's disk.
 *
 * Chrome and Edge get real Save / Save As / Open through the File System Access API, so a second
 * Save writes to the same file without asking again. Where that API is missing (or a test turns it
 * off), Save downloads a `.frame` file and Open uses a regular file input.
 */

export const FILE_EXTENSION = '.frame'
const PICKER_TYPES = [{ description: 'Frame project', accept: { 'application/json': [FILE_EXTENSION] } }]

/** Where the open project lives on disk. `handle` is present only with the File System Access API. */
export interface ProjectFile {
  name: string
  handle?: FileSystemFileHandleLike
}

export interface FileSystemFileHandleLike {
  name: string
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
  getFile(): Promise<{ text(): Promise<string>; name: string }>
}

/** The browser surface this module touches, injectable for tests. */
export interface FileEnv {
  showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandleLike>
  showOpenFilePicker?: (opts: unknown) => Promise<FileSystemFileHandleLike[]>
  download(name: string, text: string): void
  pickFile(accept: string): Promise<{ name: string; text(): Promise<string> } | null>
}

export function browserFileEnv(): FileEnv {
  const w = window as any
  return {
    showSaveFilePicker: typeof w.showSaveFilePicker === 'function' ? (o) => w.showSaveFilePicker(o) : undefined,
    showOpenFilePicker: typeof w.showOpenFilePicker === 'function' ? (o) => w.showOpenFilePicker(o) : undefined,
    download(name, text) {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    },
    pickFile(accept) {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = accept
        input.setAttribute('data-testid', 'open-input')
        input.style.display = 'none'
        input.addEventListener('change', () => {
          resolve(input.files?.[0] ?? null)
          input.remove()
        })
        input.addEventListener('cancel', () => {
          resolve(null)
          input.remove()
        })
        document.body.appendChild(input)
        input.click()
      })
    },
  }
}

/** "FY27 Plan" → "FY27 Plan.frame"; strips characters Windows and macOS reject. */
export function fileNameFor(projectName: string) {
  const base = projectName.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Untitled'
  return base.endsWith(FILE_EXTENSION) ? base : base + FILE_EXTENSION
}

const isAbort = (e: unknown) => (e as { name?: string })?.name === 'AbortError'

/**
 * Writes the project. Reuses `current`'s handle unless `saveAs`; otherwise asks where to save.
 * Returns where it was saved, or null if the user cancelled.
 */
export async function saveProjectFile(
  env: FileEnv,
  json: string,
  projectName: string,
  current: ProjectFile | null,
  saveAs: boolean,
): Promise<ProjectFile | null> {
  let handle = saveAs ? undefined : current?.handle
  if (!handle && env.showSaveFilePicker) {
    try {
      handle = await env.showSaveFilePicker({ suggestedName: fileNameFor(projectName), types: PICKER_TYPES })
    } catch (e) {
      if (isAbort(e)) return null
      throw e
    }
  }
  if (handle) {
    const w = await handle.createWritable()
    await w.write(json)
    await w.close()
    return { name: handle.name, handle }
  }
  const name = fileNameFor(projectName)
  env.download(name, json)
  return { name }
}

/** Asks for a project file and returns its text, or null if the user cancelled. */
export async function openProjectFile(env: FileEnv): Promise<{ text: string; file: ProjectFile } | null> {
  if (env.showOpenFilePicker) {
    let handles: FileSystemFileHandleLike[]
    try {
      handles = await env.showOpenFilePicker({ types: PICKER_TYPES, multiple: false })
    } catch (e) {
      if (isAbort(e)) return null
      throw e
    }
    const handle = handles[0]
    if (!handle) return null
    const f = await handle.getFile()
    return { text: await f.text(), file: { name: f.name, handle } }
  }
  const f = await env.pickFile(`${FILE_EXTENSION},.json,application/json`)
  if (!f) return null
  return { text: await f.text(), file: { name: f.name } }
}
