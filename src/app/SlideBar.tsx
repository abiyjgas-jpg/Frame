import { useRef } from 'react'
import { cannotAdd, type AddKind } from '../presentation/addToPresentation'
import type { Selection } from '../spreadsheet/SpreadsheetAdapter'

interface Props {
  background: string
  canDeleteSlide: boolean
  selection: Selection | null
  sheetName(id: string): string
  onNewSlide(): void
  onDuplicateSlide(): void
  onDeleteSlide(): void
  onAddText(): void
  onAddImage(file: File): void
  onBackground(color: string): void
  onAdd(kind: AddKind): void
}

/** Slide-level actions on the left; Add to Presentation (from the model selection) on the right. */
export function SlideBar(p: Props) {
  const file = useRef<HTMLInputElement>(null)
  const sel = p.selection ? `${p.sheetName(p.selection.sheetId)}!${p.selection.range}` : null
  return (
    <div className="slidebar" data-testid="slidebar">
      <button onClick={p.onNewSlide} data-testid="new-slide" title="New slide after this one">
        New slide
      </button>
      <button onClick={p.onDuplicateSlide} data-testid="duplicate-slide" title="Duplicate this slide (linked objects stay linked)">
        Duplicate
      </button>
      <button onClick={p.onDeleteSlide} disabled={!p.canDeleteSlide} data-testid="delete-slide" title="Delete this slide">
        Delete
      </button>
      <span className="toolbar-sep" />
      <button onClick={p.onAddText} data-testid="add-text" title="Insert a text box">
        Text
      </button>
      <button onClick={() => file.current?.click()} data-testid="add-image" title="Insert an image">
        Image
      </button>
      <input
        ref={file}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        hidden
        data-testid="image-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) p.onAddImage(f)
          e.target.value = ''
        }}
      />
      <input
        type="color"
        className="color-input"
        aria-label="Slide background"
        title="Slide background"
        data-testid="slide-background"
        value={p.background}
        onChange={(e) => p.onBackground(e.target.value)}
      />
      <div className="spacer" />
      <div className="objectbar-add" role="group" aria-label="Add to presentation">
        <span className="objectbar-label">
          Add{sel && <code className="objectbar-sel" data-testid="selection">{sel}</code>}
        </span>
        <div className="btn-group">
          {(['chart', 'table', 'kpi'] as AddKind[]).map((k) => {
            const reason = cannotAdd(k, p.selection?.range)
            return (
              <button
                key={k}
                data-testid={`add-${k}`}
                disabled={!!reason}
                title={reason ?? `Add the selected cells as a ${k === 'kpi' ? 'KPI' : k}`}
                onClick={() => p.onAdd(k)}
              >
                {k === 'kpi' ? 'KPI' : k[0].toUpperCase() + k.slice(1)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
