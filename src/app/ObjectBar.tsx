import type { Binding } from '../bindings/types'
import { cannotAdd, type AddKind } from '../presentation/addToPresentation'
import type { ChartKind } from '../presentation/objects/LinkedChart'
import type { SlideObject } from '../presentation/types'
import type { Selection } from '../spreadsheet/SpreadsheetAdapter'

const TYPE_LABEL: Record<SlideObject['type'], string> = {
  text: 'Text',
  kpi: 'KPI',
  table: 'Table',
  chart: 'Chart',
  image: 'Image',
}

interface Props {
  object?: SlideObject
  binding?: Binding
  slideNumber: number
  slideCount: number
  selection: Selection | null
  linkedCount: number
  sheetName(id: string): string
  onGoToSource(b: Binding): void
  onAdd(kind: AddKind): void
  onDelete(): void
  onChartKind(kind: ChartKind): void
}

/**
 * Context bar above the canvas. Left: the selected object and its source, or the slide position.
 * Right: Add to presentation, always available for whatever is selected in the model.
 */
export function ObjectBar(p: Props) {
  const { object, binding, selection } = p
  const sel = selection ? `${p.sheetName(selection.sheetId)}!${selection.range}` : null
  return (
    <div className="objectbar" data-testid="objectbar">
      <div className="objectbar-left" data-testid="objectbar-context">
        {object ? (
          <>
            <span className="objectbar-type">{TYPE_LABEL[object.type]}</span>
            {binding && (
              <>
                <span className="objectbar-label">Source</span>
                <code className="objectbar-source" data-testid="source">
                  {p.sheetName(binding.source.sheetId)}!{binding.source.range}
                </code>
                <button data-testid="goto-source" onClick={() => p.onGoToSource(binding)}>
                  Go to source
                </button>
              </>
            )}
            {object.type === 'chart' && (
              <select
                aria-label="Chart type"
                data-testid="chart-kind"
                value={(object.style.chartType as ChartKind) ?? 'column'}
                onChange={(e) => p.onChartKind(e.target.value as ChartKind)}
              >
                <option value="column">Column</option>
                <option value="bar">Bar</option>
                <option value="line">Line</option>
              </select>
            )}
            <button className="btn-quiet" data-testid="delete-object" title="Delete (Del)" onClick={p.onDelete}>
              Delete
            </button>
          </>
        ) : (
          <span className="objectbar-label">
            Slide {p.slideNumber} of {p.slideCount}
            {p.linkedCount > 0 && (
              <span className="objectbar-linked" data-testid="linked-count">
                {' · '}
                {p.linkedCount} linked {p.linkedCount === 1 ? 'object uses' : 'objects use'} the selected cells
              </span>
            )}
          </span>
        )}
      </div>
      <div className="objectbar-add" role="group" aria-label="Add to presentation">
        <span className="objectbar-label">
          Add{sel && <code className="objectbar-sel" data-testid="selection">{sel}</code>}
        </span>
        <div className="btn-group">
          {(['chart', 'table', 'kpi'] as AddKind[]).map((k) => {
            const reason = cannotAdd(k, selection?.range)
            return (
              <button key={k} data-testid={`add-${k}`} disabled={!!reason} title={reason ?? `Add the selected cells as a ${k === 'kpi' ? 'KPI' : k}`} onClick={() => p.onAdd(k)}>
                {k === 'kpi' ? 'KPI' : k[0].toUpperCase() + k.slice(1)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
