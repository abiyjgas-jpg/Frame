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
import { createBlankProject, FRAME_PROJECT_VERSION, type FrameProject } from '../project/FrameProject'
import { loadFromBrowser, saveToBrowser } from '../project/persistence'
import type { Selection } from '../spreadsheet/SpreadsheetAdapter'
import { UniverSpreadsheetAdapter } from '../spreadsheet/UniverSpreadsheetAdapter'
import { readImageFile } from './images'
import { ObjectBar } from './ObjectBar'
import { SlideBar } from './SlideBar'
import { TopBar } from './TopBar'

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
  const slidesRef = useRef(slides)
  slidesRef.current = slides

  /** Puts a project into the workspace (initial load and New). */
  const show = useCallback((p: FrameProject) => {
    setName(p.metadata.name)
    setSlides(p.slides)
    setAssets(p.assets)
    setActiveSlideId(p.slides[0]?.id ?? null)
    setSelectedObjectId(null)
    setEditingTextId(null)
    manager.current!.load(p.bindings)
    setBindingList(manager.current!.list())
  }, [])

  useEffect(() => {
    const project = loadFromBrowser() ?? createStarterProject()
    const a = new UniverSpreadsheetAdapter(sheetHost.current!, project.workbook as any)
    const m = new BindingManager(a)
    adapter.current = a
    manager.current = m
    m.attach()
    const unsub = m.subscribe(setValues)
    const unsubSel = a.subscribeToSelection(setSheetSelection)
    show(project)
    setStatus(project.metadata.savedAt ? 'Saved' : '')
    window.__frame = { adapter: a, bindings: m, slides: () => slidesRef.current }
    return () => {
      unsub()
      unsubSel()
      m.detach()
      a.dispose()
    }
  }, [show])

  const save = useCallback(() => {
    // Only keep images still used on a slide.
    const used = new Set(slides.flatMap((s) => s.objects.map((o) => o.assetId)))
    try {
      saveToBrowser({
        version: FRAME_PROJECT_VERSION,
        metadata: { name },
        workbook: adapter.current!.saveSnapshot(),
        slides,
        bindings: manager.current!.list(),
        assets: assets.filter((x) => used.has(x.id)),
      })
      setStatus(`Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
    } catch (e) {
      console.error(e)
      setStatus('Not saved: browser storage is full (large images?)')
    }
  }, [name, slides, assets])

  const newProject = () => {
    if (!window.confirm('Start a new project? Unsaved changes in this one will be lost.')) return
    const p = createBlankProject()
    adapter.current!.loadSnapshot(p.workbook)
    show(p)
    setStatus('Not saved')
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

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
      <TopBar name={name} status={status} onRename={setName} onNew={newProject} onSave={save} onPresent={() => setPresenting(true)} />
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
