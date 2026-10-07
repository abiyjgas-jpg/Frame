import { useEffect, useRef, useState } from 'react'
import { BindingManager, type BindingValues } from '../bindings/BindingManager'
import { formatRange, parseRange } from '../bindings/range'
import { LinkedChart } from '../presentation/LinkedChart'
import { deserializeProject, FRAME_PROJECT_VERSION, serializeProject } from '../project/FrameProject'
import { UniverSpreadsheetAdapter } from '../spreadsheet/UniverSpreadsheetAdapter'
import { initialWorkbook, SHEET_ID } from './initialWorkbook'

const STORAGE_KEY = 'frame.spike.project'
const CHART_BINDING = 'binding_chart'
const KPI_BINDING = 'binding_kpi'

declare global {
  interface Window {
    __frame?: { adapter: UniverSpreadsheetAdapter; bindings: BindingManager; lastUpdateMs: number | null }
  }
}

export function App() {
  const host = useRef<HTMLDivElement>(null)
  const adapter = useRef<UniverSpreadsheetAdapter | null>(null)
  const manager = useRef<BindingManager | null>(null)
  const [values, setValues] = useState<BindingValues>(new Map())
  const [status, setStatus] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    const project = saved ? deserializeProject(saved) : null
    const a = new UniverSpreadsheetAdapter(host.current!, (project?.workbook ?? initialWorkbook) as any)
    const m = new BindingManager(a)
    if (project) m.load(project.bindings)
    else {
      m.create('range-chart', { sheetId: SHEET_ID, range: 'A1:A3' }, { slideId: 'slide_1', objectId: 'chart_1' }, CHART_BINDING)
      m.create('cell-kpi', { sheetId: SHEET_ID, range: 'A3' }, { slideId: 'slide_1', objectId: 'kpi_1' }, KPI_BINDING)
    }
    m.attach()
    const unsub = m.subscribe((v) => setValues(v))
    adapter.current = a
    manager.current = m
    window.__frame = { adapter: a, bindings: m, lastUpdateMs: null }
    setStatus(project ? `Loaded snapshot saved ${project.metadata.savedAt}` : 'New workbook')
    return () => {
      unsub()
      m.detach()
      a.dispose()
    }
  }, [])

  const save = () => {
    const json = serializeProject({
      version: FRAME_PROJECT_VERSION,
      metadata: { name: 'Spike' },
      workbook: adapter.current!.saveSnapshot(),
      slides: [],
      bindings: manager.current!.list(),
      assets: [],
    })
    localStorage.setItem(STORAGE_KEY, json)
    setStatus(`Saved ${new Date().toLocaleTimeString()} (${(json.length / 1024).toFixed(1)} KB)`)
  }

  const reloadSnapshot = () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return setStatus('Nothing saved yet')
    const p = deserializeProject(saved)
    manager.current!.detach()
    adapter.current!.loadSnapshot(p.workbook)
    manager.current!.load(p.bindings)
    manager.current!.attach()
    setStatus(`Reloaded snapshot saved ${p.metadata.savedAt}`)
  }

  const download = () => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? ''
    const url = URL.createObjectURL(new Blob([saved], { type: 'application/json' }))
    Object.assign(document.createElement('a'), { href: url, download: 'project.frame.json' }).click()
    URL.revokeObjectURL(url)
  }

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    location.reload()
  }

  const chartBinding = manager.current?.list().find((b) => b.id === CHART_BINDING)
  const chartValues = values.get(CHART_BINDING) ?? []
  const kpi = values.get(KPI_BINDING)?.[0]?.[0]
  const rect = chartBinding ? parseRange(chartBinding.source.range) : null
  const labels = rect
    ? chartValues.flat().map((_, i) => formatRange({ ...rect, startRow: rect.startRow + i, endRow: rect.startRow + i }))
    : []

  return (
    <div className="app">
      <header className="topbar">
        <strong>Frame</strong>
        <span className="muted">Feasibility spike</span>
        <div className="spacer" />
        <span className="muted" data-testid="status">{status}</span>
        <button onClick={save} data-testid="save">Save snapshot</button>
        <button onClick={reloadSnapshot} data-testid="reload">Reload snapshot</button>
        <button onClick={download}>Download .frame.json</button>
        <button onClick={reset}>Reset</button>
      </header>
      <main className="body">
        <section className="pane model">
          <div ref={host} className="univer-host" />
        </section>
        <section className="pane presentation">
          <div className="slide">
            <h2>Spike chart</h2>
            <div className="kpi" data-testid="kpi">
              <span className="kpi-label">Total (A3)</span>
              <span className="kpi-value">{typeof kpi === 'number' ? kpi.toLocaleString() : '—'}</span>
            </div>
            <LinkedChart values={chartValues} labels={labels} />
            {chartBinding && (
              <div className="source">
                <span>SOURCE: Model!{chartBinding.source.range}</span>
                <button
                  data-testid="goto-source"
                  onClick={() => adapter.current!.selectRange(chartBinding.source.sheetId, chartBinding.source.range)}
                >
                  Go to source
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
