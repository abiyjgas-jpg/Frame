import { describe, expect, it, vi } from 'vitest'
import { createStarterProject } from '../src/demo/spikeProject'
import { fileNameFor, openProjectFile, saveProjectFile, type FileEnv, type FileSystemFileHandleLike } from '../src/project/fileAccess'
import { clearWorkspace, loadWorkspace, saveWorkspace } from '../src/project/persistence'
import { serializeProject } from '../src/project/FrameProject'

function memoryDisk() {
  const files = new Map<string, string>()
  const handle = (name: string): FileSystemFileHandleLike => ({
    name,
    async createWritable() {
      let buf = ''
      return { write: async (d: string) => void (buf += d), close: async () => void files.set(name, buf) }
    },
    async getFile() {
      return { name, text: async () => files.get(name) ?? '' }
    },
  })
  return { files, handle }
}

function env(over: Partial<FileEnv> = {}): FileEnv {
  return { download: vi.fn(), pickFile: vi.fn(async () => null), ...over }
}

const abort = () => Object.assign(new Error('cancelled'), { name: 'AbortError' })

describe('file names', () => {
  it('derives a safe .frame name from the project name', () => {
    expect(fileNameFor('FY27 Operating Plan')).toBe('FY27 Operating Plan.frame')
    expect(fileNameFor('Q3: plan / v2?')).toBe('Q3 plan v2.frame')
    expect(fileNameFor('   ')).toBe('Untitled.frame')
    expect(fileNameFor('deck.frame')).toBe('deck.frame')
  })
})

describe('save with the File System Access API', () => {
  it('asks once, then saves to the same file; Save As asks again', async () => {
    const disk = memoryDisk()
    const picker = vi.fn(async (o: any) => disk.handle(o.suggestedName))
    const e = env({ showSaveFilePicker: picker })

    const first = await saveProjectFile(e, 'v1', 'Plan', null, false)
    expect(first?.name).toBe('Plan.frame')
    expect(disk.files.get('Plan.frame')).toBe('v1')

    await saveProjectFile(e, 'v2', 'Renamed', first, false)
    expect(picker).toHaveBeenCalledTimes(1)
    expect(disk.files.get('Plan.frame')).toBe('v2')

    const copy = await saveProjectFile(e, 'v3', 'Renamed', first, true)
    expect(picker).toHaveBeenCalledTimes(2)
    expect(copy?.name).toBe('Renamed.frame')
    expect(disk.files.get('Plan.frame')).toBe('v2')
    expect(e.download).not.toHaveBeenCalled()
  })

  it('returns null when the user cancels, and passes real errors on', async () => {
    expect(await saveProjectFile(env({ showSaveFilePicker: async () => Promise.reject(abort()) }), 'x', 'P', null, false)).toBeNull()
    await expect(saveProjectFile(env({ showSaveFilePicker: async () => Promise.reject(new Error('disk full')) }), 'x', 'P', null, false)).rejects.toThrow(
      'disk full',
    )
  })
})

describe('fallback without the API', () => {
  it('downloads a .frame file every time', async () => {
    const e = env()
    const saved = await saveProjectFile(e, '{"a":1}', 'My plan', { name: 'old.frame' }, false)
    expect(saved).toEqual({ name: 'My plan.frame' })
    expect(e.download).toHaveBeenCalledWith('My plan.frame', '{"a":1}')
  })

  it('opens through a file input', async () => {
    const e = env({ pickFile: vi.fn(async () => ({ name: 'a.frame', text: async () => 'body' })) })
    expect(await openProjectFile(e)).toEqual({ text: 'body', file: { name: 'a.frame' } })
    expect(await openProjectFile(env())).toBeNull()
  })
})

describe('open with the File System Access API', () => {
  it('keeps the handle so Save writes back to the opened file', async () => {
    const disk = memoryDisk()
    disk.files.set('Budget.frame', 'original')
    const e = env({ showOpenFilePicker: async () => [disk.handle('Budget.frame')], showSaveFilePicker: vi.fn() })
    const opened = await openProjectFile(e)
    expect(opened?.text).toBe('original')
    await saveProjectFile(e, 'edited', 'Budget', opened!.file, false)
    expect(disk.files.get('Budget.frame')).toBe('edited')
    expect(e.showSaveFilePicker).not.toHaveBeenCalled()
    expect(await openProjectFile(env({ showOpenFilePicker: async () => Promise.reject(abort()) }))).toBeNull()
  })
})

class MemoryStorage {
  map = new Map<string, string>()
  getItem = (k: string) => this.map.get(k) ?? null
  setItem = (k: string, v: string) => void this.map.set(k, v)
  removeItem = (k: string) => void this.map.delete(k)
}

describe('browser workspace copy', () => {
  it('round-trips the project with its dirty flag and file name', () => {
    const storage = new MemoryStorage() as unknown as Storage
    const project = createStarterProject()
    saveWorkspace({ project, dirty: true, fileName: 'Plan.frame' }, storage)
    const back = loadWorkspace(storage)!
    expect(back.dirty).toBe(true)
    expect(back.fileName).toBe('Plan.frame')
    expect(back.project.bindings).toEqual(project.bindings)
    expect(back.project.slides).toEqual(project.slides)
    expect(back.project.workbook).toEqual(project.workbook)
    clearWorkspace(storage)
    expect(loadWorkspace(storage)).toBeNull()
  })

  it('picks up a project saved by earlier builds, and ignores junk', () => {
    const storage = new MemoryStorage() as unknown as Storage
    storage.setItem('frame.project', serializeProject(createStarterProject()))
    expect(loadWorkspace(storage)?.dirty).toBe(false)
    storage.setItem('frame.workspace', '{nope')
    expect(loadWorkspace(storage)).toBeNull()
  })
})
