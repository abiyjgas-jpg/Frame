import { useDeferredValue, useState } from 'react'
import type { BindingValues } from '../bindings/BindingManager'
import type { Binding } from '../bindings/types'
import { Slide } from './Slide'
import { SLIDE_WIDTH, type Asset, type Slide as SlideModel } from './types'

const THUMB_WIDTH = 136

interface Props {
  slides: SlideModel[]
  activeSlideId: string | null
  values: BindingValues
  bindings: Map<string, Binding>
  linkedObjectIds: Set<string>
  assets: Map<string, Asset>
  onSelect(id: string): void
  onMove(id: string, toIndex: number): void
}

/** Bottom strip of live slide thumbnails, mirroring the sheet tabs under the model. */
export function SlideThumbnails({ slides, activeSlideId, values: liveValues, bindings, linkedObjectIds, assets, onSelect, onMove }: Props) {
  // Thumbnails repaint after the main canvas, so they never slow down the update the user is watching.
  const values = useDeferredValue(liveValues)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  return (
    <nav className="thumbs" aria-label="Slides">
      {slides.map((s, i) => (
        <button
          key={s.id}
          className={`thumb ${s.id === activeSlideId ? 'is-active' : ''} ${s.objects.some((o) => linkedObjectIds.has(o.id)) ? 'is-linked' : ''} ${
            dragId && dropIndex === i && dragId !== s.id ? 'is-drop-target' : ''
          }`}
          draggable
          onDragStart={(e) => {
            setDragId(s.id)
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', s.id)
          }}
          onDragOver={(e) => {
            if (!dragId) return
            e.preventDefault()
            setDropIndex(i)
          }}
          onDrop={(e) => {
            e.preventDefault()
            const id = dragId ?? e.dataTransfer.getData('text/plain')
            if (id) onMove(id, i)
            setDragId(null)
            setDropIndex(null)
          }}
          onDragEnd={() => {
            setDragId(null)
            setDropIndex(null)
          }}
          data-testid={`thumb-${s.id}`}
          aria-current={s.id === activeSlideId}
          title={s.title || `Slide ${i + 1}`}
          onClick={() => onSelect(s.id)}
        >
          <span className="thumb-index">{i + 1}</span>
          <Slide slide={s} scale={THUMB_WIDTH / SLIDE_WIDTH} values={values} bindings={bindings} assets={assets} interactive={false} />
        </button>
      ))}
    </nav>
  )
}
