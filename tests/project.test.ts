import { describe, expect, it } from 'vitest'
import { BindingManager } from '../src/bindings/BindingManager'
import { createStarterProject } from '../src/demo/spikeProject'
import { createBlankProject, deserializeProject, FRAME_PROJECT_VERSION, serializeProject, type FrameProject } from '../src/project/FrameProject'
import { FakeSheet } from './fakeSheet'

const project: FrameProject = {
  version: FRAME_PROJECT_VERSION,
  metadata: { name: 'FY27 Operating Plan' },
  workbook: { id: 'wb', sheets: { s1: { cellData: { 2: { 0: { f: '=SUM(A1:A2)' } } } } } },
  slides: [
    {
      id: 'sl',
      title: 'Revenue',
      objects: [{ id: 'ch', type: 'chart', slideId: 'sl', x: 10, y: 20, width: 300, height: 200, style: {}, bindingId: 'binding_001' }],
    },
  ],
  bindings: [
    { id: 'binding_001', type: 'range-chart', source: { sheetId: 's1', range: 'A1:A3' }, target: { slideId: 'sl', objectId: 'ch' } },
  ],
  assets: [],
}

describe('project serialization', () => {
  it('round-trips a project', () => {
    const back = deserializeProject(serializeProject(project))
    expect(back.bindings).toEqual(project.bindings)
    expect(back.workbook).toEqual(project.workbook)
    expect(back.slides).toEqual(project.slides)
    expect(back.metadata.name).toBe('FY27 Operating Plan')
    expect(back.metadata.savedAt).toMatch(/^\d{4}-/)
  })

  it('rejects malformed files with a readable error', () => {
    expect(() => deserializeProject('{')).toThrow(/invalid JSON/)
    expect(() => deserializeProject(JSON.stringify({ ...project, version: 99 }))).toThrow(/version 99/)
    expect(() => deserializeProject(JSON.stringify({ ...project, workbook: null }))).toThrow(/workbook/)
    expect(() => deserializeProject(JSON.stringify({ ...project, bindings: [{ id: 'x' }] }))).toThrow(/Invalid binding/)
    expect(() => deserializeProject(JSON.stringify({ ...project, slides: [{ id: 's' }] }))).toThrow(/Invalid slide/)
    const badObject = [{ id: 's', objects: [{ id: 'o', type: 'text', x: 0, y: 0, width: '10', height: 10 }] }]
    expect(() => deserializeProject(JSON.stringify({ ...project, slides: badObject }))).toThrow(/Invalid object/)
  })

  it('restored bindings resolve against the sheet', () => {
    const sheet = new FakeSheet()
    sheet.set('s1', 0, 0, 1)
    sheet.set('s1', 1, 0, 2)
    sheet.set('s1', 2, 0, 3)
    const m = new BindingManager(sheet, (fn) => fn())
    m.load(deserializeProject(serializeProject(project)).bindings)
    m.attach()
    expect(m.getValues('binding_001')).toEqual([[1], [2], [3]])
  })
})

describe('project factories', () => {
  it('blank project has one sheet, one empty slide, no bindings', () => {
    const p = deserializeProject(serializeProject(createBlankProject('X')))
    expect(p.metadata.name).toBe('X')
    expect(p.slides).toHaveLength(1)
    expect(p.slides[0].objects).toEqual([])
    expect(p.bindings).toEqual([])
  })

  it('starter project: every binding targets an object that points back at it', () => {
    const p = createStarterProject()
    const objects = p.slides.flatMap((s) => s.objects)
    for (const b of p.bindings) {
      const o = objects.find((x) => x.id === b.target.objectId)
      expect(o?.bindingId).toBe(b.id)
      expect(o?.slideId).toBe(b.target.slideId)
    }
    for (const o of objects.filter((x) => x.bindingId)) expect(p.bindings.some((b) => b.id === o.bindingId)).toBe(true)
  })
})
