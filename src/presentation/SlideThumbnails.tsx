import { useDeferredValue } from 'react'
import type { BindingValues } from '../bindings/BindingManager'
import type { Binding } from '../bindings/types'
import { Slide } from './Slide'
import { SLIDE_WIDTH, type Slide as SlideModel } from './types'

const THUMB_WIDTH = 136

interface Props {
  slides: SlideModel[]
  activeSlideId: string | null
  values: BindingValues
  bindings: Map<string, Binding>
  onSelect(id: string): void
}

/** Bottom strip of live slide thumbnails, mirroring the sheet tabs under the model. */
export function SlideThumbnails({ slides, activeSlideId, values: liveValues, bindings, onSelect }: Props) {
  // Thumbnails repaint after the main canvas, so they never slow down the update the user is watching.
  const values = useDeferredValue(liveValues)
  return (
    <nav className="thumbs" aria-label="Slides">
      {slides.map((s, i) => (
        <button
          key={s.id}
          className={`thumb ${s.id === activeSlideId ? 'is-active' : ''}`}
          data-testid={`thumb-${s.id}`}
          aria-current={s.id === activeSlideId}
          title={s.title || `Slide ${i + 1}`}
          onClick={() => onSelect(s.id)}
        >
          <span className="thumb-index">{i + 1}</span>
          <Slide slide={s} scale={THUMB_WIDTH / SLIDE_WIDTH} values={values} bindings={bindings} interactive={false} />
        </button>
      ))}
    </nav>
  )
}
