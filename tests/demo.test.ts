import { describe, expect, it } from 'vitest'
import { parseRange } from '../src/bindings/range'
import { createDemoProject } from '../src/demo/fy27Demo'
import { deserializeProject, serializeProject } from '../src/project/FrameProject'
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../src/presentation/types'

describe('FY27 Operating Plan demo', () => {
  const p = createDemoProject()
  const wb = p.workbook as any

  it('has the spec sheets and slides, in order', () => {
    expect(wb.sheetOrder.map((id: string) => wb.sheets[id].name)).toEqual(['Assumptions', 'Revenue', 'Headcount', 'P&L'])
    expect(p.slides.map((s) => s.title)).toEqual(['FY27 Operating Plan', 'Revenue Outlook', 'Profitability', 'Headcount'])
  })

  it('links every linked object to a binding that points back at it, on a real sheet', () => {
    const objects = p.slides.flatMap((s) => s.objects)
    for (const o of objects.filter((o) => o.bindingId)) {
      const b = p.bindings.find((b) => b.id === o.bindingId)!
      expect(b.target).toEqual({ slideId: o.slideId, objectId: o.id })
      expect(wb.sheets[b.source.sheetId]).toBeDefined()
      expect(() => parseRange(b.source.range)).not.toThrow()
    }
    expect(p.bindings).toHaveLength(objects.filter((o) => o.bindingId).length)
  })

  it('keeps every object on its slide', () => {
    for (const o of p.slides.flatMap((s) => s.objects)) {
      expect(o.x >= 0 && o.y >= 0 && o.x + o.width <= SLIDE_WIDTH && o.y + o.height <= SLIDE_HEIGHT).toBe(true)
    }
  })

  it('drives revenue from the Enterprise growth assumption', () => {
    expect(wb.sheets['sheet-assumptions'].cellData[3][1].v).toBe(0.12)
    expect(wb.sheets['sheet-revenue'].cellData[1][2].f).toBe('=B2*(1+Assumptions!$B$4)')
  })

  it('returns independent copies and survives serialization', () => {
    createDemoProject().slides[0].objects.pop()
    expect(createDemoProject().slides[0].objects).toHaveLength(5)
    expect(deserializeProject(serializeProject(p)).bindings).toEqual(p.bindings)
  })
})
