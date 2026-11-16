import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BindingManager, type BindingValues } from '../bindings/BindingManager'
import { SplitPane } from '../components/SplitPane'
import { createStarterProject } from '../demo/spikeProject'
import { PresentationCanvas } from '../presentation/PresentationCanvas'
import { SlideThumbnails } from '../presentation/SlideThumbnails'
import type { Slide, SlideObject } from '../presentation/types'
import { BINDING_TYPE, cannotAdd, defaultSize, kpiLabelFor, newObjectId, normaliseRange, placeNewObject, type AddKind } from '../presentation/addToPresentation'
import type { ChartKind } from '../presentation/objects/LinkedChart'
import { formatRange, parseRange } from '../bindings/range'
import type { Selection } from '../spreadsheet/SpreadsheetAdapter'
import { createBlankProject, type FrameProject } from '../project/FrameProject'
import { loadFromBrowser, saveToBrowser } from '../project/persistence'
import { UniverSpreadsheetAdapter } from '../spreadsheet/UniverSpreadsheetAdapter'
import { ObjectBar } from './ObjectBar'
import { TopBar } from './TopBar'

declare global {
  interface Window {
    __frame?: { adapter: UniverSpreadsheetAdapter; bindings: BindingManager }
  }
}

export function App() {
  const sheetHost = useRef<HTMLDivElement>(null)
  const adapter = useRef<UniverSpreadsheetAdapter | null>(null)
  const manager = useRef<BindingManager | null>(null)

  const [name, setName] = useState('')
  const [slides, setSlides] = useState<Slide[]>([])
  const [bindingList, setBindingList] = useState<FrameProject['bindings']>([])
  const [values, setValues] = useState<BindingValues>(new Map())
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null)
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [sheetSelection, setSheetSelection] = useState<Selection | null>(null)

  /** Puts a project into the workspace (initial load and New). */
  const show = useCallback((p: FrameProject) => {
    setName(p.metadata.name)
    setSlides(p.slides)
    setActiveSlideId(p.slides[0]?.id ?? null)
    setSelectedObjectId(null)
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
    window.__frame = { adapter: a, bindings: m }
    return () => {
      unsub()
      unsubSel()
      m.detach()
      a.dispose()
    }
  }, [show])

  const save = useCallback(() => {
    saveToBrowser({
      version: 1,
      metadata: { name },
      workbook: adapter.current!.saveSnapshot(),
      slides,
      bindings: manager.current!.list(),
      assets: [],
    })
    setStatus(`Saved ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
  }, [name, slides])

  const newProject = () => {
    if (!window.confirm('Start a new project? Unsaved changes in this one will be lost.')) return
    const p = createBlankProject()
    adapter.current!.loadSnapshot(p.workbook)
    show(p)
    setStatus('Not saved')
  }

  const updateObject = (id: string, patch: (o: SlideObject) => SlideObject) =>
    setSlides((all) => all.map((s) => ({ ...s, objects: s.objects.map((o) => (o.id === id ? patch(o) : o)) })))

  /** Add to Presentation: the selected range becomes a linked object on the current slide. */
  const addToPresentation = (kind: AddKind) => {
    const sel = adapter.current!.getSelection()
    const slide = slides.find((s) => s.id === activeSlideId)
    if (!sel || !slide || cannotAdd(kind, sel.range)) return
    const range = normaliseRange(sel.range)
    const type = kind === 'kpi' ? 'kpi' : kind
    const id = newObjectId(type)
    const binding = manager.current!.create(BINDING_TYPE[kind], { sheetId: sel.sheetId, range }, { slideId: slide.id, objectId: id })
    const { width, height } = defaultSize(kind, range)
    const object: SlideObject = {
      id,
      type,
      slideId: slide.id,
      ...placeNewObject(slide.objects, width, height),
      style: kind === 'chart' ? { chartType: 'column' } : {},
      bindingId: binding.id,
      text: kind === 'kpi' ? kpiLabel(sel.sheetId, range) : undefined,
    }
    setSlides((all) => all.map((s) => (s.id === slide.id ? { ...s, objects: [...s.objects, object] } : s)))
    setBindingList(manager.current!.list())
    setSelectedObjectId(id)
  }

  const kpiLabel = (sheetId: string, cell: string) =>
    kpiLabelFor(
      cell,
      (row, col) => adapter.current!.getRangeDisplayValues(sheetId, formatRange({ startRow: row, startCol: col, endRow: row, endCol: col }))[0]?.[0] ?? '',
      `${sheetName(sheetId)}!${cell}`,
    )

  /** Deleting a linked object also deletes its binding. */
  const deleteSelected = () => {
    const obj = slides.flatMap((s) => s.objects).find((o) => o.id === selectedObjectId)
    if (!obj) return
    if (obj.bindingId) manager.current!.delete(obj.bindingId)
    setSlides((all) => all.map((s) => ({ ...s, objects: s.objects.filter((o) => o.id !== obj.id) })))
    setBindingList(manager.current!.list())
    setSelectedObjectId(null)
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

  const bindings = useMemo(() => new Map(bindingList.map((b) => [b.id, b])), [bindingList])
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
  const activeSlide = slides.find((s) => s.id === activeSlideId)
  const selected = activeSlide?.objects.find((o) => o.id === selectedObjectId)

  return (
    <div className="app">
      <TopBar name={name} status={status} onRename={setName} onNew={newProject} onSave={save} />
      <SplitPane
        left={
          <section className="pane-model" aria-label="Model">
            <div ref={sheetHost} className="univer-host" />
          </section>
        }
        right={
          <section className="pane-presentation" aria-label="Presentation">
            <ObjectBar
              object={selected}
              binding={selected?.bindingId ? bindings.get(selected.bindingId) : undefined}
              slideNumber={slides.findIndex((s) => s.id === activeSlideId) + 1}
              slideCount={slides.length}
              selection={sheetSelection}
              linkedCount={linkedObjectIds.size}
              sheetName={sheetName}
              onGoToSource={(b) => adapter.current!.selectRange(b.source.sheetId, b.source.range)}
              onAdd={addToPresentation}
              onDelete={deleteSelected}
              onChartKind={(kind: ChartKind) => updateObject(selectedObjectId!, (o) => ({ ...o, style: { ...o.style, chartType: kind } }))}
            />
            <PresentationCanvas
              slide={activeSlide}
              values={values}
              bindings={bindings}
              selectedObjectId={selectedObjectId}
              linkedObjectIds={linkedObjectIds}
              onSelectObject={setSelectedObjectId}
              onDeleteSelected={deleteSelected}
            />
            <SlideThumbnails
              slides={slides}
              activeSlideId={activeSlideId}
              values={values}
              bindings={bindings}
              linkedObjectIds={linkedObjectIds}
              onSelect={(id) => {
                setActiveSlideId(id)
                setSelectedObjectId(null)
              }}
            />
          </section>
        }
      />
    </div>
  )
}
