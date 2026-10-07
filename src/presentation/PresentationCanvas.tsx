import { useEffect, useRef, useState } from 'react'
import type { BindingValues } from '../bindings/BindingManager'
import type { Binding } from '../bindings/types'
import { fitScale } from '../utils/layout'
import { Slide } from './Slide'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type Slide as SlideModel } from './types'

interface Props {
  slide: SlideModel | undefined
  values: BindingValues
  bindings: Map<string, Binding>
  selectedObjectId: string | null
  onSelectObject(id: string | null): void
}

/** The editing surface: the active slide, scaled to fit the pane. */
export function PresentationCanvas({ slide, values, bindings, selectedObjectId, onSelectObject }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  useEffect(() => {
    const el = host.current!
    const ro = new ResizeObserver(() => setScale(fitScale(el.clientWidth, el.clientHeight, SLIDE_WIDTH, SLIDE_HEIGHT, 24)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={host} className="canvas" onPointerDown={() => onSelectObject(null)}>
      {slide && (
        <Slide
          slide={slide}
          scale={scale}
          values={values}
          bindings={bindings}
          selectedObjectId={selectedObjectId}
          onSelectObject={onSelectObject}
        />
      )}
    </div>
  )
}
