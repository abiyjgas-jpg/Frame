import { useEffect, useRef, useState } from 'react'
import type { BindingValues } from '../bindings/BindingManager'
import type { Binding } from '../bindings/types'
import { fitScale } from '../utils/layout'
import type { Rect } from './deck'
import { Slide } from './Slide'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type Asset, type Slide as SlideModel } from './types'

interface Props {
  slide: SlideModel | undefined
  values: BindingValues
  bindings: Map<string, Binding>
  assets: Map<string, Asset>
  selectedObjectId: string | null
  linkedObjectIds: Set<string>
  editingTextId: string | null
  onSelectObject(id: string | null): void
  onDeleteSelected(): void
  onDuplicateSelected(): void
  onCommitRect(id: string, rect: Rect): void
  onStartEditText(id: string): void
  onCommitText(id: string, text: string): void
}

/** The editing surface: the active slide, scaled to fit the pane, with keyboard editing. */
export function PresentationCanvas(p: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)

  useEffect(() => {
    const el = host.current!
    const ro = new ResizeObserver(() => setScale(fitScale(el.clientWidth, el.clientHeight, SLIDE_WIDTH, SLIDE_HEIGHT, 24)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Keep keyboard focus on the canvas after an object is created or text editing ends.
  useEffect(() => {
    if (p.selectedObjectId && !p.editingTextId && document.activeElement === document.body) host.current?.focus({ preventScroll: true })
  }, [p.selectedObjectId, p.editingTextId])

  const selected = p.slide?.objects.find((o) => o.id === p.selectedObjectId)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!selected || p.editingTextId) return
    const step = e.shiftKey ? 10 : 1
    const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
    if (nudge) p.onCommitRect(selected.id, { x: selected.x + nudge[0], y: selected.y + nudge[1], width: selected.width, height: selected.height })
    else if (e.key === 'Delete' || e.key === 'Backspace') p.onDeleteSelected()
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') p.onDuplicateSelected()
    else if (e.key === 'Enter' && selected.type === 'text') p.onStartEditText(selected.id)
    else if (e.key === 'Escape') p.onSelectObject(null)
    else return
    e.preventDefault()
  }

  return (
    <div
      ref={host}
      className="canvas"
      tabIndex={-1}
      data-testid="canvas"
      // Focus the canvas so Delete and arrows go to slide objects, not to the sheet.
      onPointerDownCapture={() => host.current!.focus({ preventScroll: true })}
      onPointerDown={() => p.onSelectObject(null)}
      onKeyDown={onKeyDown}
    >
      {p.slide && (
        <Slide
          slide={p.slide}
          scale={scale}
          values={p.values}
          bindings={p.bindings}
          assets={p.assets}
          selectedObjectId={p.selectedObjectId}
          linkedObjectIds={p.linkedObjectIds}
          editingTextId={p.editingTextId}
          onSelectObject={p.onSelectObject}
          onCommitRect={p.onCommitRect}
          onStartEditText={p.onStartEditText}
          onCommitText={p.onCommitText}
        />
      )}
    </div>
  )
}
