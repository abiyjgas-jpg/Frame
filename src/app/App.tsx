import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BindingManager, type BindingValues } from '../bindings/BindingManager'
import { SplitPane } from '../components/SplitPane'
import { createStarterProject } from '../demo/spikeProject'
import { PresentationCanvas } from '../presentation/PresentationCanvas'
import { SlideThumbnails } from '../presentation/SlideThumbnails'
import type { Slide } from '../presentation/types'
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
    show(project)
    setStatus(project.metadata.savedAt ? 'Saved' : '')
    window.__frame = { adapter: a, bindings: m }
    return () => {
      unsub()
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
              sheetName={(id) => adapter.current?.getSheets().find((s) => s.id === id)?.name ?? id}
              onGoToSource={(b) => adapter.current!.selectRange(b.source.sheetId, b.source.range)}
            />
            <PresentationCanvas
              slide={activeSlide}
              values={values}
              bindings={bindings}
              selectedObjectId={selectedObjectId}
              onSelectObject={setSelectedObjectId}
            />
            <SlideThumbnails
              slides={slides}
              activeSlideId={activeSlideId}
              values={values}
              bindings={bindings}
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
