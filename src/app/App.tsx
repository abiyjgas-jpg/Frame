import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BindingManager, type BindingValues } from '../bindings/BindingManager'
import { formatRange, parseRange } from '../bindings/range'
import type { Binding } from '../bindings/types'
import { SplitPane } from '../components/SplitPane'
import { createStarterProject } from '../demo/spikeProject'
import {
  BINDING_TYPE,
  cannotAdd,
  defaultSize,
  kpiLabelFor,
  newObjectId,
  normaliseRange,
  placeNewObject,
  type AddKind,
} from '../presentation/addToPresentation'
import * as deckOps from '../presentation/deck'
import { PresentationCanvas } from '../presentation/PresentationCanvas'
import { PresentMode } from '../presentation/PresentMode'
import { SlideThumbnails } from '../presentation/SlideThumbnails'
import type { Asset, Slide, SlideObject } from '../presentation/types'
import { createBlankProject, deserializeProject, FRAME_PROJECT_VERSION, serializeProject, type FrameProject } from '../project/FrameProject'
import { browserFileEnv, openProjectFile, saveProjectFile, type ProjectFile } from '../project/fileAccess'
import { loadWorkspace, saveWorkspace } from '../project/persistence'
import type { Selection } from '../spreadsheet/SpreadsheetAdapter'
import { UniverSpreadsheetAdapter } from '../spreadsheet/UniverSpreadsheetAdapter'
import { readImageFile } from './images'
import { ObjectBar } from './ObjectBar'
import { SlideBar } from './SlideBar'
import { TopBar } from './TopBar'

/** What the project looked like when it was last opened or saved; any difference is unsaved work. */
interface CleanState {
  name: string
  slides: Slide[]
  assets: Asset[]
  bindings: Binding[]
  sheetRev: number
  /** Restored from the browser with changes that never reached a file. */
  dirty: boolean
}

const clock = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const AUTOSAVE_DELAY_MS = 500

declare global {
  interface Window {
    __frame?: { adapter: UniverSpreadsheetAdapter; bindings: BindingManager; slides(): Slide[] }
  }
}

export function App() {
  const sheetHost = useRef<HTMLDivElement>(null)
  const adapter = useRef<UniverSpreadsheetAdapter | null>(null)
  const manager = useRef<BindingManager | null>(null)

  const [name, setName] = useState('')
  const [slides, setSlides] = useState<Slide[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [bindingList, setBindingList] = useState<Binding[]>([])
  const [values, setValues] = useState<BindingValues>(new Map())
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [presenting, setPresenting] = useState(false)
  const [status, setStatus] = useState('')
  const [sheetSelection, setSheetSelection] = useState<Selection | null>(null)
  const [file, setFile] = useState<ProjectFile | null>(null)
  const [sheetRev, setSheetRev] = useState(0)
  const [clean, setClean] = useState<CleanState | null>(null)
  /** False when the browser copy could not be written (storage full), so leaving would lose work. */
  const [workspaceSafe, setWorkspaceSafe] = useState(true)
  const slidesRef = useRef(slides)
  slidesRef.current = slides
  const sheetRevRef = useRef(sheetRev)
  sheetRevRef.current = sheetRev

  const dirty =
    !!clean &&
    (clean.dirty ||
      clean.name !== name ||
      clean.slides !== slides ||
      clean.assets !== assets ||
      clean.bindings !== bindingList ||
      clean.sheetRev !== sheetRev)

  /** Puts a project into the workspace (initial load, New and Open). */
  const show = useCallback((p: FrameProject, opts: { file: ProjectFile | null; dirty: boolean }) => {
    setName(p.metadata.name)
    setSlides(p.slides)
    setAssets(p.assets)
    setActiveSlideId(p.slides[0]?.id ?? null)
    setSelectedObjectId(null)
    setEditingTextId(null)
    manager.current!.load(p.bindings)
    const bindings = manager.current!.list()
    setBindingList(bindings)
    setFile(opts.file)
    setClean({ name: p.metadata.name, slides: p.slides, assets: p.assets, bindings, sheetRev: sheetRevRef.current, dirty: opts.dirty })
  }, [])

  useEffect(() => {
    const restored = loadWorkspace()
    const project = restored?.project ?? createStarterProject()
    const a = new UniverSpreadsheetAdapter(sheetHost.current!, project.workbook as any)
    const m = new BindingManager(a)
    adapter.current = a
    manager.current = m
    m.attach()
    const unsub = m.subscribe(setValues)
    const unsubSel = a.subscribeToSelection(setSheetSelection)
    const unsubEdits = a.subscribeToEdits(() => setSheetRev((r) => r + 1))
    show(project, { file: restored?.fileName ? { name: restored.fileName } : null, dirty: restored?.dirty ?? false })
    window.__frame = { adapter: a, bindings: m, slides: () => slidesRef.current }
    return () => {
      unsub()
      unsubSel()
      unsubEdits()
      m.detach()
      a.dispose()
    }
  }, [show])

  /** The open project as it would be written to a file. Only images still on a slide are kept. */
  const currentProject = (): FrameProject => {
    const used = new Set(slides.flatMap((s) => s.objects.map((o) => o.assetId)))
    return {
      version: FRAME_PROJECT_VERSION,
      metadata: { name },
      workbook: adapter.current!.saveSnapshot(),
      slides,
      bindings: manager.current!.list(),
      assets: assets.filter((x) => used.has(x.id)),
    }
  }

  // --- browser copy (autosave) ------------------------------------------------------------------
  const writeWorkspace = () => {
    if (!adapter.current || !clean) return
    try {
      saveWorkspace({ project: currentProject(), dirty, fileName: file?.name ?? null })
      setWorkspaceSafe(true)
    } catch (e) {
      console.error('Autosave failed', e)
      setWorkspaceSafe(false)
    }
  }
  const writeWorkspaceRef = useRef(writeWorkspace)
  writeWorkspaceRef.current = writeWorkspace

  useEffect(() => {
    const t = setTimeout(() => writeWorkspaceRef.current(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [name, slides, assets, bindingList, sheetRev, dirty, file])

  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const workspaceSafeRef = useRef(workspaceSafe)
  workspaceSafeRef.current = workspaceSafe
  useEffect(() => {
    const flush = () => writeWorkspaceRef.current()
    // The browser copy normally makes leaving safe; warn only when it could not be written.
    const guard = (e: BeforeUnloadEvent) => {
      flush()
      if (dirtyRef.current && !workspaceSafeRef.current) e.preventDefault()
    }
    window.addEventListener('pagehide', flush)
    window.addEventListener('beforeunload', guard)
    return () => {
      window.removeEventListener('pagehide', flush)
      window.removeEventListener('beforeunload', guard)
    }
  }, [])

  useEffect(() => {
    document.title = `${dirty ? '• ' : ''}${name || 'Untitled'} – Frame`
  }, [name, dirty])

  // --- project files ----------------------------------------------------------------------------
  const busy = useRef(false)

  const save = async (saveAs = false) => {
    if (busy.current || !clean) return
    busy.current = true
    try {
      const project = currentProject()
      const snapshot: CleanState = { name, slides, assets, bindings: bindingList, sheetRev, dirty: false }
      const saved = await saveProjectFile(browserFileEnv(), serializeProject(project), name, file, saveAs)
      if (!saved) return
      setFile(saved)
      setClean(snapshot)
      setStatus(`Saved to ${saved.name} at ${clock()}`)
    } catch (e) {
      console.error(e)
      setStatus(`Not saved: ${(e as Error).message || 'the file could not be written'}`)
    } finally {
      busy.current = false
    }
  }

  const open = async () => {
    if (busy.current) return
    busy.current = true
    try {
      const picked = await openProjectFile(browserFileEnv())
      if (!picked) return
      let project: FrameProject
      try {
        project = deserializeProject(picked.text)
      } catch (e) {
        window.alert(`Couldn't open ${picked.file.name}: ${(e as Error).message}`)
        return
      }
      if (dirtyRef.current && !window.confirm(`Open ${picked.file.name}? Unsaved changes in this project will be lost.`)) return
      const previous = adapter.current!.saveSnapshot()
      try {
        adapter.current!.loadSnapshot(project.workbook)
      } catch (e) {
        console.error(e)
        adapter.current!.loadSnapshot(previous)
        window.alert(`Couldn't open ${picked.file.name}: its workbook could not be loaded.`)
        return
      }
      show(project, { file: picked.file, dirty: false })
      setStatus(`Opened ${picked.file.name}`)
    } catch (e) {
      console.error(e)
      setStatus(`Couldn't open the file: ${(e as Error).message}`)
    } finally {
      busy.current = false
    }
  }

  const newProject = () => {
    if (dirty && !window.confirm('Start a new project? Unsaved changes in this one will be lost.')) return
    const p = createBlankProject()
    adapter.current!.loadSnapshot(p.workbook)
    show(p, { file: null, dirty: false })
    setStatus('New project')
  }

  // --- bindings kept in step with slide edits -------------------------------------------------
  const syncBindings = (removed: string[], added: Binding[] = []) => {
    removed.forEach((id) => manager.current!.delete(id))
    added.forEach((b) => manager.current!.create(b.type, b.source, b.target, b.id))
    setBindingList(manager.current!.list())
  }

  // --- objects ----------------------------------------------------------------------------------
  const activeSlide = slides.find((s) => s.id === activeSlideId)
  const selected = activeSlide?.objects.find((o) => o.id === selectedObjectId)

  const addObject = (object: SlideObject) => {
    setSlides((d) => deckOps.addObject(d, object.slideId, object))
    setSelectedObjectId(object.id)
  }

  /** Add to Presentation: the selected range becomes a linked object on the current slide. */
  const addToPresentation = (kind: AddKind) => {
    const sel = adapter.current!.getSelection()
    if (!sel || !activeSlide || cannotAdd(kind, sel.range)) return
    const range = normaliseRange(sel.range)
    const id = newObjectId(kind)
    const binding = manager.current!.create(BINDING_TYPE[kind], { sheetId: sel.sheetId, range }, { slideId: activeSlide.id, objectId: id })
    const { width, height } = defaultSize(kind, range)
    setBindingList(manager.current!.list())
    addObject({
      id,
      type: kind,
      slideId: activeSlide.id,
      ...placeNewObject(activeSlide.objects, width, height),
      style: kind === 'chart' ? { chartType: 'column' } : {},
      bindingId: binding.id,
      text: kind === 'kpi' ? kpiLabel(sel.sheetId, range) : undefined,
    })
  }

  const kpiLabel = (sheetId: string, cell: string) =>
    kpiLabelFor(
      cell,
      (row, col) => adapter.current!.getRangeDisplayValues(sheetId, formatRange({ startRow: row, startCol: col, endRow: row, endCol: col }))[0]?.[0] ?? '',
      `${sheetName(sheetId)}!${cell}`,
    )

  const addText = () => {
    if (!activeSlide) return
    const object: SlideObject = {
      id: newObjectId('text'),
      type: 'text',
      slideId: activeSlide.id,
      ...placeNewObject(activeSlide.objects, 640, 64),
      style: { fontSize: 32, fontWeight: activeSlide.objects.length ? 400 : 600 },
      text: 'Text',
    }
    addObject(object)
    setEditingTextId(object.id)
  }

  const addImage = async (file: File) => {
    if (!activeSlide) return
    try {
      const img = await readImageFile(file)
      const asset: Asset = { id: deckOps.makeId('asset'), name: file.name, mime: file.type, dataUrl: img.dataUrl }
      setAssets((a) => [...a, asset])
      addObject({
        id: newObjectId('image'),
        type: 'image',
        slideId: activeSlide.id,
        ...placeNewObject(activeSlide.objects, img.width, img.height),
        style: {},
        assetId: asset.id,
      })
    } catch (e) {
      window.alert((e as Error).message)
    }
  }

  const deleteSelected = () => {
    if (!selectedObjectId) return
    const r = deckOps.deleteObject(slides, selectedObjectId)
    setSlides(r.deck)
    syncBindings(r.removedBindingIds)
    setSelectedObjectId(null)
  }

  const duplicateSelected = () => {
    if (!selectedObjectId) return
    const r = deckOps.duplicateObject(slides, selectedObjectId, bindingMap)
    setSlides(r.deck)
    syncBindings([], r.newBindings)
    setSelectedObjectId(r.newObjectId)
  }

  const patchSelected = (patch: Partial<SlideObject>) => selectedObjectId && setSlides((d) => deckOps.updateObject(d, selectedObjectId, patch))

  // --- slides -----------------------------------------------------------------------------------
  const selectSlide = (id: string | null) => {
    setActiveSlideId(id)
    setSelectedObjectId(null)
    setEditingTextId(null)
  }

  const newSlide = () => {
    const r = deckOps.addSlide(slides, activeSlideId)
    setSlides(r.deck)
    selectSlide(r.slideId)
  }

  const duplicateSlide = () => {
    if (!activeSlideId) return
    const r = deckOps.duplicateSlide(slides, activeSlideId, bindingMap)
    setSlides(r.deck)
    syncBindings([], r.newBindings)
    selectSlide(r.slideId)
  }

  const deleteSlide = () => {
    if (!activeSlide || slides.length < 2) return
    if (activeSlide.objects.length && !window.confirm('Delete this slide and everything on it?')) return
    const r = deckOps.deleteSlide(slides, activeSlide.id)
    setSlides(r.deck)
    syncBindings(r.removedBindingIds)
    selectSlide(r.nextActiveId)
  }

  const sheetName = (id: string) => adapter.current?.getSheets().find((s) => s.id === id)?.name ?? id

  const fileCommands = useRef({ save, open })
  fileCommands.current = { save, open }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        void fileCommands.current.save(e.shiftKey)
      } else if (key === 'o' && !e.shiftKey) {
        e.preventDefault()
        void fileCommands.current.open()
      }
    }
    // Capture phase, so the sheet editor can't swallow the shortcuts.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const bindingMap = useMemo(() => new Map(bindingList.map((b) => [b.id, b])), [bindingList])
  const assetMap = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets])
  // Reverse traceability: which slide objects read the cells selected in the model.
  const linkedObjectIds = useMemo(() => {
    if (!sheetSelection) return new Set<string>()
    try {
      parseRange(sheetSelection.range)
    } catch {
      return new Set<string>()
    }
    return new Set(manager.current?.bindingsForRange(sheetSelection.sheetId, sheetSelection.range).map((b) => b.target.objectId) ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetSelection, bindingList])

  const activeIndex = slides.findIndex((s) => s.id === activeSlideId)

  return (
    <div className="app">
      <TopBar
        name={name}
        status={status}
        dirty={dirty}
        fileName={file?.name ?? null}
        onRename={setName}
        onNew={newProject}
        onOpen={() => void open()}
        onSave={() => void save(false)}
        onSaveAs={() => void save(true)}
        onPresent={() => setPresenting(true)}
      />
      <SplitPane
        left={
          <section className="pane-model" aria-label="Model">
            <div ref={sheetHost} className="univer-host" />
          </section>
        }
        right={
          <section className="pane-presentation" aria-label="Presentation">
            <SlideBar
              background={activeSlide?.background ?? '#ffffff'}
              canDeleteSlide={slides.length > 1}
              selection={sheetSelection}
              sheetName={sheetName}
              onNewSlide={newSlide}
              onDuplicateSlide={duplicateSlide}
              onDeleteSlide={deleteSlide}
              onAddText={addText}
              onAddImage={addImage}
              onBackground={(c) => setSlides((d) => d.map((s) => (s.id === activeSlideId ? { ...s, background: c } : s)))}
              onAdd={addToPresentation}
            />
            <ObjectBar
              object={selected}
              binding={selected?.bindingId ? bindingMap.get(selected.bindingId) : undefined}
              slideNumber={activeIndex + 1}
              slideCount={slides.length}
              linkedCount={linkedObjectIds.size}
              sheetName={sheetName}
              onGoToSource={(b) => adapter.current!.selectRange(b.source.sheetId, b.source.range)}
              onDelete={deleteSelected}
              onDuplicate={duplicateSelected}
              onArrange={(where) => selectedObjectId && setSlides((d) => deckOps.reorderObject(d, selectedObjectId, where))}
              onAlign={(how) => selected && patchSelected(deckOps.alignRect(selected, how))}
              onStyle={(patch) => selected && patchSelected({ style: { ...selected.style, ...patch } })}
            />
            <PresentationCanvas
              slide={activeSlide}
              values={values}
              bindings={bindingMap}
              assets={assetMap}
              selectedObjectId={selectedObjectId}
              linkedObjectIds={linkedObjectIds}
              editingTextId={editingTextId}
              onSelectObject={(id) => {
                setSelectedObjectId(id)
                if (id !== editingTextId) setEditingTextId(null)
              }}
              onDeleteSelected={deleteSelected}
              onDuplicateSelected={duplicateSelected}
              onCommitRect={(id, rect) => setSlides((d) => deckOps.updateObject(d, id, deckOps.clampRect(rect)))}
              onStartEditText={setEditingTextId}
              onCommitText={(id, text) => {
                setSlides((d) => deckOps.updateObject(d, id, { text }))
                setEditingTextId(null)
              }}
            />
            <SlideThumbnails
              slides={slides}
              activeSlideId={activeSlideId}
              values={values}
              bindings={bindingMap}
              assets={assetMap}
              linkedObjectIds={linkedObjectIds}
              onSelect={selectSlide}
              onMove={(id, to) => setSlides((d) => deckOps.moveSlide(d, id, to))}
            />
          </section>
        }
      />
      {presenting && (
        <PresentMode
          slides={slides}
          startIndex={Math.max(0, activeIndex)}
          values={values}
          bindings={bindingMap}
          assets={assetMap}
          onExit={(i) => {
            setPresenting(false)
            if (slides[i]) selectSlide(slides[i].id)
          }}
        />
      )}
    </div>
  )
}
