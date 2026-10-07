/** Logical slide size. Objects are positioned in these units; the canvas scales to fit. */
export const SLIDE_WIDTH = 1280
export const SLIDE_HEIGHT = 720

export type SlideObjectType = 'text' | 'kpi' | 'table' | 'chart' | 'image'

export interface SlideObject {
  id: string
  type: SlideObjectType
  slideId: string
  x: number
  y: number
  width: number
  height: number
  style: Record<string, string | number>
  /** Linked objects (kpi, table, chart). */
  bindingId?: string
  /** Text content (text) or label (kpi, chart title). */
  text?: string
}

export interface Slide {
  id: string
  title: string
  background?: string
  objects: SlideObject[]
}
