import { REF_ERROR } from '../bindings/range'
import type { Binding } from '../bindings/types'
import type { Align } from '../presentation/deck'
import type { ChartKind } from '../presentation/objects/LinkedChart'
import type { SlideObject } from '../presentation/types'

const TYPE_LABEL: Record<SlideObject['type'], string> = {
  text: 'Text',
  kpi: 'KPI',
  table: 'Table',
  chart: 'Chart',
  image: 'Image',
}

const SIZES = [14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72, 96]

const ALIGN: { how: Align; label: string; title: string }[] = [
  { how: 'left', label: '⇤', title: 'Align left' },
  { how: 'center', label: '↔', title: 'Centre horizontally' },
  { how: 'right', label: '⇥', title: 'Align right' },
  { how: 'top', label: '⤒', title: 'Align top' },
  { how: 'middle', label: '↕', title: 'Centre vertically' },
  { how: 'bottom', label: '⤓', title: 'Align bottom' },
]

interface Props {
  object?: SlideObject
  binding?: Binding
  slideNumber: number
  slideCount: number
  linkedCount: number
  sheetName(id: string): string
  onGoToSource(b: Binding): void
  onDelete(): void
  onDuplicate(): void
  onArrange(where: 'front' | 'back'): void
  onAlign(how: Align): void
  onStyle(patch: Record<string, string | number>): void
}

/** Context bar: the selected object's source and formatting, or the slide position. */
export function ObjectBar(p: Props) {
  const { object: o, binding } = p
  if (!o)
    return (
      <div className="objectbar" data-testid="objectbar">
        <div className="objectbar-left" data-testid="objectbar-context">
          <span className="objectbar-label">
            Slide {p.slideNumber} of {p.slideCount}
            {p.linkedCount > 0 && (
              <span className="objectbar-linked" data-testid="linked-count">
                {' · '}
                {p.linkedCount} linked {p.linkedCount === 1 ? 'object uses' : 'objects use'} the selected cells
              </span>
            )}
          </span>
        </div>
      </div>
    )

  const s = o.style
  const bold = s.fontWeight === 600 || s.fontWeight === 'bold'
  return (
    <div className="objectbar" data-testid="objectbar">
      <div className="objectbar-left" data-testid="objectbar-context">
        <span className="objectbar-type">{TYPE_LABEL[o.type]}</span>
        {binding && (
          <>
            <code className="objectbar-source" data-testid="source" title="Source">
              {p.sheetName(binding.source.sheetId)}!{binding.source.range}
            </code>
            <button data-testid="goto-source" disabled={binding.source.range === REF_ERROR} onClick={() => p.onGoToSource(binding)}>
              Go to source
            </button>
          </>
        )}
        {o.type === 'chart' && (
          <select aria-label="Chart type" data-testid="chart-kind" value={(s.chartType as ChartKind) ?? 'column'} onChange={(e) => p.onStyle({ chartType: e.target.value })}>
            <option value="column">Column</option>
            <option value="bar">Bar</option>
            <option value="line">Line</option>
          </select>
        )}
        {o.type === 'text' && (
          <>
            <select aria-label="Font size" data-testid="font-size" value={Number(s.fontSize) || 24} onChange={(e) => p.onStyle({ fontSize: Number(e.target.value) })}>
              {SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button className={`btn-icon ${bold ? 'btn-on' : ''}`} data-testid="bold" title="Bold" aria-pressed={bold} onClick={() => p.onStyle({ fontWeight: bold ? 400 : 600 })}>
              <b>B</b>
            </button>
            <button
              className={`btn-icon ${s.fontStyle === 'italic' ? 'btn-on' : ''}`}
              data-testid="italic"
              title="Italic"
              aria-pressed={s.fontStyle === 'italic'}
              onClick={() => p.onStyle({ fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' })}
            >
              <i>I</i>
            </button>
            <input
              type="color"
              className="color-input"
              aria-label="Text colour"
              data-testid="text-color"
              value={typeof s.color === 'string' ? s.color : '#1d2430'}
              onChange={(e) => p.onStyle({ color: e.target.value })}
            />
            <select aria-label="Text alignment" data-testid="text-align" value={(s.textAlign as string) ?? 'left'} onChange={(e) => p.onStyle({ textAlign: e.target.value })}>
              <option value="left">Left</option>
              <option value="center">Centre</option>
              <option value="right">Right</option>
            </select>
          </>
        )}
        <span className="toolbar-sep" />
        {ALIGN.map((a) => (
          <button key={a.how} className="btn-icon" title={a.title} aria-label={a.title} data-testid={`align-${a.how}`} onClick={() => p.onAlign(a.how)}>
            {a.label}
          </button>
        ))}
        <span className="toolbar-sep" />
        <button className="btn-icon" title="Bring to front" aria-label="Bring to front" onClick={() => p.onArrange('front')}>
          ⇡
        </button>
        <button className="btn-icon" title="Send to back" aria-label="Send to back" onClick={() => p.onArrange('back')}>
          ⇣
        </button>
        <button data-testid="duplicate-object" title="Duplicate (Ctrl+D)" onClick={p.onDuplicate}>
          Duplicate
        </button>
        <button className="btn-quiet" data-testid="delete-object" title="Delete (Del)" onClick={p.onDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}
