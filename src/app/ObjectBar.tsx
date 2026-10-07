import type { Binding } from '../bindings/types'
import type { SlideObject } from '../presentation/types'

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
  sheetName(id: string): string
  onGoToSource(b: Binding): void
}

/** Thin context bar above the canvas: slide position, or the selected object and its source. */
export function ObjectBar({ object, binding, slideNumber, slideCount, sheetName, onGoToSource }: Props) {
  return (
    <div className="objectbar" data-testid="objectbar">
      {object ? (
        <>
          <span className="objectbar-type">{TYPE_LABEL[object.type]}</span>
          {binding && (
            <>
              <span className="objectbar-label">Source</span>
              <code className="objectbar-source" data-testid="source">
                {sheetName(binding.source.sheetId)}!{binding.source.range}
              </code>
              <button data-testid="goto-source" onClick={() => onGoToSource(binding)}>
                Go to source
              </button>
            </>
          )}
        </>
      ) : (
        <span className="objectbar-label">
          Slide {slideNumber} of {slideCount}
        </span>
      )}
    </div>
  )
}
