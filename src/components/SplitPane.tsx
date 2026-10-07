import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { clampSplit } from '../utils/layout'

const STORAGE_KEY = 'frame.split'
const MIN_LEFT = 360
const MIN_RIGHT = 420
const DIVIDER = 5

function readRatio() {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY))
    return v > 0 && v < 1 ? v : 0.5
  } catch {
    return 0.5
  }
}

/** Two panes with a draggable divider. Ratio is remembered per browser. Double-click resets to 50/50. */
export function SplitPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(readRatio)
  const [dragging, setDragging] = useState(false)

  const apply = useCallback((r: number) => {
    const width = root.current?.clientWidth ?? 1440
    const next = clampSplit(r, width, MIN_LEFT, MIN_RIGHT)
    setRatio(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      /* storage unavailable: keep in memory only */
    }
  }, [])

  useEffect(() => {
    const onResize = () => apply(ratio)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [apply, ratio])

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !root.current) return
    const rect = root.current.getBoundingClientRect()
    apply((e.clientX - rect.left) / rect.width)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.02
    if (e.key === 'ArrowLeft') apply(ratio - step)
    else if (e.key === 'ArrowRight') apply(ratio + step)
    else return
    e.preventDefault()
  }

  return (
    <div ref={root} className={`split ${dragging ? 'is-dragging' : ''}`} style={{ gridTemplateColumns: `${ratio}fr ${DIVIDER}px ${1 - ratio}fr` }}>
      <div className="split-pane">{left}</div>
      <div
        className="split-divider"
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Resize model and presentation"
        tabIndex={0}
        data-testid="divider"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onDoubleClick={() => apply(0.5)}
        onKeyDown={onKeyDown}
      />
      <div className="split-pane">{right}</div>
    </div>
  )
}
