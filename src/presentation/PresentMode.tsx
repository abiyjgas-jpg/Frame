import { useEffect, useRef, useState } from 'react'
import type { BindingValues } from '../bindings/BindingManager'
import type { Binding } from '../bindings/types'
import { fitScale } from '../utils/layout'
import { Slide } from './Slide'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type Asset, type Slide as SlideModel } from './types'

interface Props {
  slides: SlideModel[]
  startIndex: number
  values: BindingValues
  bindings: Map<string, Binding>
  assets: Map<string, Asset>
  onExit(lastIndex: number): void
}

/**
 * Full-screen slideshow. Values stay live: the model can still change underneath (e.g. on a second
 * screen) and the slides follow. Next: → ↓ Space PageDown Enter or click. Previous: ← ↑ PageUp
 * Backspace. Home/End jump. Escape exits.
 */
export function PresentMode({ slides, startIndex, values, bindings, assets, onExit }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(Math.min(Math.max(0, startIndex), slides.length - 1))
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [cursor, setCursor] = useState(false)
  const indexRef = useRef(index)
  indexRef.current = index
  const exitRef = useRef(onExit)
  exitRef.current = onExit

  useEffect(() => {
    const el = root.current!
    el.focus()
    el.requestFullscreen?.().catch(() => {
      /* not allowed (e.g. automated browser): the overlay still fills the window */
    })
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    const onFsChange = () => {
      if (!document.fullscreenElement) exitRef.current(indexRef.current)
    }
    window.addEventListener('resize', onResize)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('fullscreenchange', onFsChange)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!cursor) return
    const t = setTimeout(() => setCursor(false), 2000)
    return () => clearTimeout(t)
  }, [cursor])

  const go = (delta: number) => setIndex((i) => Math.min(slides.length - 1, Math.max(0, i + delta)))
  const slide = slides[index]
  if (!slide) return null

  return (
    <div
      ref={root}
      className={`present ${cursor ? 'show-cursor' : ''}`}
      data-testid="present"
      tabIndex={-1}
      role="dialog"
      aria-label="Presentation"
      onMouseMove={() => setCursor(true)}
      onClick={() => go(1)}
      onKeyDown={(e) => {
        const k = e.key
        if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) go(1)
        else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) go(-1)
        else if (k === 'Home') setIndex(0)
        else if (k === 'End') setIndex(slides.length - 1)
        else if (k === 'Escape') onExit(index)
        else return
        e.preventDefault()
      }}
    >
      <Slide
        slide={slide}
        scale={fitScale(size.w, size.h, SLIDE_WIDTH, SLIDE_HEIGHT)}
        values={values}
        bindings={bindings}
        assets={assets}
        interactive={false}
        testId="present-slide"
      />
      <div className="present-counter" data-testid="present-counter">
        {index + 1} / {slides.length}
      </div>
    </div>
  )
}
