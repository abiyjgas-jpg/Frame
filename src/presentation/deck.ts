import type { Binding } from '../bindings/types'
import { SLIDE_HEIGHT, SLIDE_WIDTH, type Slide, type SlideObject } from './types'

/**
 * Pure slide-deck edits. Functions that remove or copy linked objects report the bindings to
 * delete or create, so the caller keeps BindingManager in step with the slides.
 */

export type IdGen = (prefix: string) => string

let seq = 0
export const makeId: IdGen = (prefix) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`

export const MIN_SIZE = 24

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Keeps an object at least MIN_SIZE and on the slide (objects larger than the slide stay centred over it). */
export function clampRect(r: Rect): Rect {
  const width = Math.max(MIN_SIZE, Math.round(r.width))
  const height = Math.max(MIN_SIZE, Math.round(r.height))
  const fit = (v: number, size: number, max: number) => (size <= max ? Math.min(max - size, Math.max(0, v)) : Math.max(max - size, Math.min(0, v)))
  return { x: fit(Math.round(r.x), width, SLIDE_WIDTH), y: fit(Math.round(r.y), height, SLIDE_HEIGHT), width, height }
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** Applies a drag of (dx, dy) on a resize handle. */
export function resizeRect(r: Rect, handle: Handle, dx: number, dy: number): Rect {
  let { x, y, width, height } = r
  // Edges being dragged stop at the slide's edges; the opposite edge stays put.
  if (handle.includes('e')) width = Math.max(MIN_SIZE, Math.min(SLIDE_WIDTH - x, width + dx))
  if (handle.includes('s')) height = Math.max(MIN_SIZE, Math.min(SLIDE_HEIGHT - y, height + dy))
  if (handle.includes('w')) {
    const w = Math.max(MIN_SIZE, Math.min(x + width, width - dx))
    x += width - w
    width = w
  }
  if (handle.includes('n')) {
    const h = Math.max(MIN_SIZE, Math.min(y + height, height - dy))
    y += height - h
    height = h
  }
  return clampRect({ x, y, width, height })
}

export type Align = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

/** Aligns an object to the slide's content margins (64 px) or centre lines. */
export function alignRect(r: Rect, how: Align, margin = 64): Rect {
  switch (how) {
    case 'left':
      return { ...r, x: margin }
    case 'center':
      return { ...r, x: Math.round((SLIDE_WIDTH - r.width) / 2) }
    case 'right':
      return { ...r, x: SLIDE_WIDTH - margin - r.width }
    case 'top':
      return { ...r, y: margin }
    case 'middle':
      return { ...r, y: Math.round((SLIDE_HEIGHT - r.height) / 2) }
    case 'bottom':
      return { ...r, y: SLIDE_HEIGHT - margin - r.height }
  }
}

export function findObject(deck: Slide[], id: string | null | undefined): SlideObject | undefined {
  if (!id) return undefined
  for (const s of deck) for (const o of s.objects) if (o.id === id) return o
  return undefined
}

export function updateObject(deck: Slide[], id: string, patch: Partial<SlideObject>): Slide[] {
  return deck.map((s) =>
    s.objects.some((o) => o.id === id) ? { ...s, objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch, id: o.id, slideId: s.id } : o)) } : s,
  )
}

export function addObject(deck: Slide[], slideId: string, object: SlideObject): Slide[] {
  return deck.map((s) => (s.id === slideId ? { ...s, objects: [...s.objects, { ...object, slideId }] } : s))
}

export function deleteObject(deck: Slide[], id: string): { deck: Slide[]; removedBindingIds: string[] } {
  const o = findObject(deck, id)
  return {
    deck: deck.map((s) => ({ ...s, objects: s.objects.filter((x) => x.id !== id) })),
    removedBindingIds: o?.bindingId ? [o.bindingId] : [],
  }
}

/** Order objects paint in: later is on top. */
export function reorderObject(deck: Slide[], id: string, where: 'front' | 'back'): Slide[] {
  return deck.map((s) => {
    const o = s.objects.find((x) => x.id === id)
    if (!o) return s
    const rest = s.objects.filter((x) => x.id !== id)
    return { ...s, objects: where === 'front' ? [...rest, o] : [o, ...rest] }
  })
}

/** Copies an object (and its binding, if linked) onto `toSlideId`, offset so the copy is visible. */
function copyObject(o: SlideObject, toSlideId: string, bindings: Map<string, Binding>, newId: IdGen, offset: number) {
  const id = newId(o.type)
  let binding: Binding | undefined
  const src = o.bindingId ? bindings.get(o.bindingId) : undefined
  if (src) binding = { ...src, id: newId('binding'), source: { ...src.source }, target: { slideId: toSlideId, objectId: id } }
  const object: SlideObject = {
    ...o,
    id,
    slideId: toSlideId,
    style: { ...o.style },
    bindingId: binding?.id,
    ...clampRect({ x: o.x + offset, y: o.y + offset, width: o.width, height: o.height }),
  }
  if (!binding) delete object.bindingId
  return { object, binding }
}

export function duplicateObject(deck: Slide[], id: string, bindings: Map<string, Binding>, newId: IdGen = makeId) {
  const o = findObject(deck, id)
  if (!o) return { deck, newObjectId: null, newBindings: [] as Binding[] }
  const { object, binding } = copyObject(o, o.slideId, bindings, newId, 24)
  return { deck: addObject(deck, o.slideId, object), newObjectId: object.id, newBindings: binding ? [binding] : [] }
}

export function addSlide(deck: Slide[], afterId: string | null, newId: IdGen = makeId): { deck: Slide[]; slideId: string } {
  const slide: Slide = { id: newId('slide'), title: '', objects: [] }
  const i = afterId ? deck.findIndex((s) => s.id === afterId) : deck.length - 1
  return { deck: [...deck.slice(0, i + 1), slide, ...deck.slice(i + 1)], slideId: slide.id }
}

export function deleteSlide(deck: Slide[], id: string): { deck: Slide[]; removedBindingIds: string[]; nextActiveId: string | null } {
  const i = deck.findIndex((s) => s.id === id)
  if (i < 0) return { deck, removedBindingIds: [], nextActiveId: null }
  const removed = deck[i].objects.flatMap((o) => (o.bindingId ? [o.bindingId] : []))
  const next = deck.filter((s) => s.id !== id)
  return { deck: next, removedBindingIds: removed, nextActiveId: next[Math.min(i, next.length - 1)]?.id ?? null }
}

export function duplicateSlide(deck: Slide[], id: string, bindings: Map<string, Binding>, newId: IdGen = makeId) {
  const i = deck.findIndex((s) => s.id === id)
  if (i < 0) return { deck, slideId: null, newBindings: [] as Binding[] }
  const src = deck[i]
  const slideId = newId('slide')
  const newBindings: Binding[] = []
  const objects = src.objects.map((o) => {
    const { object, binding } = copyObject(o, slideId, bindings, newId, 0)
    if (binding) newBindings.push(binding)
    return object
  })
  const copy: Slide = { ...src, id: slideId, title: src.title, objects }
  return { deck: [...deck.slice(0, i + 1), copy, ...deck.slice(i + 1)], slideId, newBindings }
}

export function moveSlide(deck: Slide[], id: string, toIndex: number): Slide[] {
  const i = deck.findIndex((s) => s.id === id)
  if (i < 0) return deck
  const to = Math.max(0, Math.min(deck.length - 1, toIndex))
  const next = deck.filter((s) => s.id !== id)
  next.splice(to, 0, deck[i])
  return next
}
