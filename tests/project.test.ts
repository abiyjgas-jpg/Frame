import { describe, expect, it } from 'vitest'
import { BindingManager } from '../src/bindings/BindingManager'
import { deserializeProject, FRAME_PROJECT_VERSION, serializeProject, type FrameProject } from '../src/project/FrameProject'
import { FakeSheet } from './fakeSheet'

const project: FrameProject = {
  version: FRAME_PROJECT_VERSION,
  metadata: { name: 'FY27 Operating Plan' },
  workbook: { id: 'wb', sheets: { s1: { cellData: { 2: { 0: { f: '=SUM(A1:A2)' } } } } } },
  slides: [],
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
    expect(back.metadata.name).toBe('FY27 Operating Plan')
    expect(back.metadata.savedAt).toMatch(/^\d{4}-/)
  })

  it('rejects malformed files with a readable error', () => {
    expect(() => deserializeProject('{')).toThrow(/invalid JSON/)
    expect(() => deserializeProject(JSON.stringify({ ...project, version: 99 }))).toThrow(/version 99/)
    expect(() => deserializeProject(JSON.stringify({ ...project, workbook: null }))).toThrow(/workbook/)
    expect(() => deserializeProject(JSON.stringify({ ...project, bindings: [{ id: 'x' }] }))).toThrow(/Invalid binding/)
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
