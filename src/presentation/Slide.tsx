import type { BindingValues } from '../bindings/BindingManager'
import type { Binding } from '../bindings/types'
import { ObjectView } from './objects/ObjectView'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type Slide as SlideModel } from './types'

interface Props {
  slide: SlideModel
  scale: number
  values: BindingValues
  bindings: Map<string, Binding>
  selectedObjectId?: string | null
  onSelectObject?(id: string | null): void
  /** Thumbnails are not interactive. */
  interactive?: boolean
}

/** One slide at logical 1280×720, scaled with a CSS transform so object coordinates never change. */
export function Slide({ slide, scale, values, bindings, selectedObjectId, onSelectObject, interactive = true }: Props) {
  return (
    <div className="slide-frame" style={{ width: SLIDE_WIDTH * scale, height: SLIDE_HEIGHT * scale }}>
      <div
        className="slide"
        data-testid={interactive ? 'slide' : undefined}
        style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, transform: `scale(${scale})`, background: slide.background ?? '#fff' }}
        onPointerDown={interactive ? () => onSelectObject?.(null) : undefined}
      >
        {slide.objects.map((o) => (
          <div
            key={o.id}
            className={`slide-object ${interactive && o.id === selectedObjectId ? 'is-selected' : ''}`}
            data-testid={interactive ? `object-${o.id}` : undefined}
            style={{ left: o.x, top: o.y, width: o.width, height: o.height }}
            onPointerDown={
              interactive
                ? (e) => {
                    e.stopPropagation()
                    onSelectObject?.(o.id)
                  }
                : undefined
            }
          >
            <ObjectView object={o} binding={o.bindingId ? bindings.get(o.bindingId) : undefined} values={values} />
          </div>
        ))}
      </div>
    </div>
  )
}
