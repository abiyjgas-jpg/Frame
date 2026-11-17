import { describe, expect, it } from 'vitest'
import type { Binding } from '../src/bindings/types'
import {
  addSlide,
  alignRect,
  clampRect,
  deleteObject,
  deleteSlide,
  duplicateObject,
  duplicateSlide,
  findObject,
  moveSlide,
  reorderObject,
  resizeRect,
  updateObject,
} from '../src/presentation/deck'
import { SLIDE_WIDTH, type Slide } from '../src/presentation/types'

let n = 0
const ids = (p: string) => `${p}-${++n}`

const binding: Binding = { id: 'b1', type: 'range-chart', source: { sheetId: 's', range: 'A1:B2' }, target: { slideId: 'sl1', objectId: 'chart1' } }
const bindings = new Map([[binding.id, binding]])
const deck: Slide[] = [
  {
    id: 'sl1',
    title: 'One',
    objects: [
      { id: 'chart1', type: 'chart', slideId: 'sl1', x: 100, y: 100, width: 400, height: 300, style: { chartType: 'line' }, bindingId: 'b1' },
      { id: 'text1', type: 'text', slideId: 'sl1', x: 64, y: 32, width: 600, height: 60, style: {}, text: 'Hello' },
    ],
  },
  { id: 'sl2', title: 'Two', objects: [] },
]

describe('geometry', () => {
  it('resizes from each handle and anchors the opposite edge', () => {
    const r = { x: 100, y: 100, width: 200, height: 100 }
    expect(resizeRect(r, 'se', 50, 20)).toEqual({ x: 100, y: 100, width: 250, height: 120 })
    expect(resizeRect(r, 'nw', 50, 20)).toEqual({ x: 150, y: 120, width: 150, height: 80 })
    expect(resizeRect(r, 'w', -30, 999)).toEqual({ x: 70, y: 100, width: 230, height: 100 })
  })
  it('never shrinks below the minimum size, even dragging past the opposite edge', () => {
    const r = resizeRect({ x: 100, y: 100, width: 200, height: 100 }, 'e', -500, 0)
    expect(r.width).toBe(24)
    const l = resizeRect({ x: 100, y: 100, width: 200, height: 100 }, 'w', 500, 0)
    expect(l).toMatchObject({ width: 24, x: 276 })
  })
  it('keeps objects on the slide', () => {
    expect(clampRect({ x: -5000, y: 9000, width: 100, height: 50 })).toEqual({ x: 0, y: 670, width: 100, height: 50 })
    expect(clampRect({ x: 1250, y: 10, width: 100, height: 50 }).x).toBe(1180)
  })
  it('resizing stops at the slide edge', () => {
    expect(resizeRect({ x: 1000, y: 600, width: 200, height: 100 }, 'se', 500, 500)).toEqual({ x: 1000, y: 600, width: 280, height: 120 })
    expect(resizeRect({ x: 10, y: 10, width: 200, height: 100 }, 'nw', -500, -500)).toEqual({ x: 0, y: 0, width: 210, height: 110 })
  })
  it('aligns to slide margins and centre', () => {
    const r = { x: 300, y: 300, width: 200, height: 100 }
    expect(alignRect(r, 'left').x).toBe(64)
    expect(alignRect(r, 'center').x).toBe((SLIDE_WIDTH - 200) / 2)
    expect(alignRect(r, 'right').x).toBe(SLIDE_WIDTH - 64 - 200)
    expect(alignRect(r, 'middle').y).toBe(310)
  })
})

describe('objects', () => {
  it('updates one object and keeps its id and slide', () => {
    const d = updateObject(deck, 'text1', { text: 'Bye', id: 'hack', slideId: 'sl2' } as never)
    expect(findObject(d, 'text1')).toMatchObject({ text: 'Bye', slideId: 'sl1' })
    expect(findObject(deck, 'text1')?.text).toBe('Hello') // immutable
  })
  it('deleting a linked object reports its binding', () => {
    const r = deleteObject(deck, 'chart1')
    expect(findObject(r.deck, 'chart1')).toBeUndefined()
    expect(r.removedBindingIds).toEqual(['b1'])
    expect(deleteObject(deck, 'text1').removedBindingIds).toEqual([])
  })
  it('duplicating a linked object creates a new binding to the same source', () => {
    const r = duplicateObject(deck, 'chart1', bindings, ids)
    const copy = findObject(r.deck, r.newObjectId!)!
    expect(copy).toMatchObject({ type: 'chart', x: 124, y: 124, style: { chartType: 'line' } })
    expect(r.newBindings).toHaveLength(1)
    expect(r.newBindings[0]).toMatchObject({ source: binding.source, target: { slideId: 'sl1', objectId: copy.id } })
    expect(copy.bindingId).toBe(r.newBindings[0].id)
    expect(copy.bindingId).not.toBe('b1')
  })
  it('duplicating a plain object creates no binding', () => {
    const r = duplicateObject(deck, 'text1', bindings, ids)
    expect(r.newBindings).toEqual([])
    expect(findObject(r.deck, r.newObjectId!)?.bindingId).toBeUndefined()
  })
  it('brings to front and sends to back', () => {
    expect(reorderObject(deck, 'chart1', 'front')[0].objects.map((o) => o.id)).toEqual(['text1', 'chart1'])
    expect(reorderObject(deck, 'text1', 'back')[0].objects.map((o) => o.id)).toEqual(['text1', 'chart1'])
  })
})

describe('slides', () => {
  it('adds after the given slide', () => {
    const r = addSlide(deck, 'sl1', ids)
    expect(r.deck.map((s) => s.id)).toEqual(['sl1', r.slideId, 'sl2'])
  })
  it('deletes a slide, reports its bindings and picks the next active slide', () => {
    const r = deleteSlide(deck, 'sl1')
    expect(r.deck.map((s) => s.id)).toEqual(['sl2'])
    expect(r.removedBindingIds).toEqual(['b1'])
    expect(r.nextActiveId).toBe('sl2')
    expect(deleteSlide([deck[1]], 'sl2').nextActiveId).toBeNull()
  })
  it('duplicates a slide with fresh object ids and independent bindings', () => {
    const r = duplicateSlide(deck, 'sl1', bindings, ids)
    expect(r.deck.map((s) => s.id)).toEqual(['sl1', r.slideId, 'sl2'])
    const copy = r.deck[1]
    expect(copy.objects).toHaveLength(2)
    expect(copy.objects.every((o) => o.slideId === r.slideId)).toBe(true)
    expect(copy.objects.map((o) => o.id)).not.toContain('chart1')
    expect(copy.objects[0]).toMatchObject({ x: 100, y: 100 }) // same position as the original
    expect(r.newBindings[0].target).toEqual({ slideId: r.slideId, objectId: copy.objects[0].id })
  })
  it('moves slides and clamps the target index', () => {
    expect(moveSlide(deck, 'sl2', 0).map((s) => s.id)).toEqual(['sl2', 'sl1'])
    expect(moveSlide(deck, 'sl1', 99).map((s) => s.id)).toEqual(['sl2', 'sl1'])
  })
})
