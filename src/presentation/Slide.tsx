import { useEffect, useRef, useState } from 'react'
import type { BindingValues } from '../bindings/BindingManager'
import type { Binding } from '../bindings/types'
import { clampRect, resizeRect, type Handle, type Rect } from './deck'
import { ObjectView, textStyle } from './objects/ObjectView'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type Asset, type Slide as SlideModel } from './types'

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

interface Props {
  slide: SlideModel
  scale: number
  values: BindingValues
  bindings: Map<string, Binding>
  assets?: Map<string, Asset>
  selectedObjectId?: string | null
  /** Objects linked to the cells currently selected in the model. */
  linkedObjectIds?: Set<string>
  editingTextId?: string | null
  onSelectObject?(id: string | null): void
  onCommitRect?(id: string, rect: Rect): void
  onStartEditText?(id: string): void
  onCommitText?(id: string, text: string): void
  /** Thumbnails and presentation mode are not interactive. */
  interactive?: boolean
  testId?: string
}

interface Gesture {
  id: string
  handle: Handle | null // null = move
  startX: number
  startY: number
  start: Rect
  rect: Rect
  moved: boolean
}

/** One slide at logical 1280×720, scaled with a CSS transform so object coordinates never change. */
export function Slide(p: Props) {
  const { slide, scale, interactive = true } = p
  const [gesture, setGesture] = useState<Gesture | null>(null)

  const begin = (e: React.PointerEvent, id: string, start: Rect, handle: Handle | null) => {
    if (e.button !== 0) return
    e.stopPropagation()
    p.onSelectObject?.(id)
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    setGesture({ id, handle, startX: e.clientX, startY: e.clientY, start, rect: start, moved: false })
  }
  const move = (e: React.PointerEvent) => {
    if (!gesture) return
    const dx = (e.clientX - gesture.startX) / scale
    const dy = (e.clientY - gesture.startY) / scale
    const moved = gesture.moved || Math.abs(dx) * scale > 2 || Math.abs(dy) * scale > 2
    if (!moved) return
    const rect = gesture.handle
      ? resizeRect(gesture.start, gesture.handle, dx, dy)
      : clampRect({ ...gesture.start, x: gesture.start.x + dx, y: gesture.start.y + dy })
    setGesture({ ...gesture, rect, moved })
  }
  const end = () => {
    if (gesture?.moved) p.onCommitRect?.(gesture.id, gesture.rect)
    setGesture(null)
  }

  return (
    <div className="slide-frame" style={{ width: SLIDE_WIDTH * scale, height: SLIDE_HEIGHT * scale }}>
      <div
        className="slide"
        data-testid={p.testId ?? (interactive ? 'slide' : undefined)}
        style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, transform: `scale(${scale})`, background: slide.background ?? '#fff' }}
        onPointerDown={interactive ? () => p.onSelectObject?.(null) : undefined}
      >
        {slide.objects.map((o) => {
          const r = gesture?.id === o.id ? gesture.rect : o
          const selected = interactive && o.id === p.selectedObjectId
          const editing = interactive && o.id === p.editingTextId
          return (
            <div
              key={o.id}
              className={[
                'slide-object',
                selected ? 'is-selected' : '',
                p.linkedObjectIds?.has(o.id) ? 'is-linked' : '',
                gesture?.id === o.id && gesture.moved ? 'is-dragging' : '',
              ].join(' ')}
              data-testid={interactive ? `object-${o.id}` : undefined}
              style={{ left: r.x, top: r.y, width: r.width, height: r.height }}
              onPointerDown={interactive && !editing ? (e) => begin(e, o.id, { x: o.x, y: o.y, width: o.width, height: o.height }, null) : undefined}
              onPointerMove={interactive ? move : undefined}
              onPointerUp={interactive ? end : undefined}
              onPointerCancel={interactive ? () => setGesture(null) : undefined}
              onDoubleClick={interactive && o.type === 'text' ? () => p.onStartEditText?.(o.id) : undefined}
            >
              {editing ? (
                <TextEditor initial={o.text ?? ''} style={textStyle(o)} onDone={(t) => p.onCommitText?.(o.id, t)} />
              ) : (
                <ObjectView object={o} binding={o.bindingId ? p.bindings.get(o.bindingId) : undefined} values={p.values} assets={p.assets} />
              )}
              {selected &&
                !editing &&
                HANDLES.map((h) => (
                  <div
                    key={h}
                    className={`handle handle-${h}`}
                    data-testid={`handle-${h}`}
                    // Handles stay the same size on screen whatever the zoom.
                    style={{ ['--hs' as string]: `${10 / scale}px` }}
                    onPointerDown={(e) => begin(e, o.id, { x: o.x, y: o.y, width: o.width, height: o.height }, h)}
                    onPointerMove={move}
                    onPointerUp={end}
                  />
                ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** In-place text editing. Enter adds a line; Escape or clicking away commits; Ctrl/Cmd+Enter commits. */
function TextEditor({ initial, style, onDone }: { initial: string; style: React.CSSProperties; onDone(text: string): void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = () => {
    if (done.current) return
    done.current = true
    onDone(ref.current?.value ?? initial)
  }
  return (
    <textarea
      ref={ref}
      className="obj-text-editor"
      data-testid="text-editor"
      defaultValue={initial}
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={finish}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          finish()
        }
      }}
    />
  )
}
