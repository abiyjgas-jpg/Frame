import { FRAME_PROJECT_VERSION, type FrameProject } from '../project/FrameProject'

/**
 * Starter project until the FY27 Operating Plan demo lands (Days 25–27):
 * the spike's sheet plus two slides, one with a live KPI and chart.
 */
export function createStarterProject(): FrameProject {
  return {
    version: FRAME_PROJECT_VERSION,
    metadata: { name: 'Untitled analysis' },
    workbook: {
      id: 'workbook',
      name: 'Untitled analysis',
      sheetOrder: ['sheet-model'],
      sheets: {
        'sheet-model': {
          id: 'sheet-model',
          name: 'Model',
          rowCount: 1000,
          columnCount: 26,
          cellData: {
            0: { 0: { v: 100 } },
            1: { 0: { v: 200 } },
            2: { 0: { f: '=SUM(A1:A2)' } },
          },
        },
      },
    },
    slides: [
      {
        id: 'slide-1',
        title: 'Title',
        objects: [
          { id: 'text-1', type: 'text', slideId: 'slide-1', x: 96, y: 280, width: 1088, height: 96, style: { fontSize: 56, fontWeight: 600 }, text: 'Untitled analysis' },
          { id: 'text-2', type: 'text', slideId: 'slide-1', x: 96, y: 384, width: 1088, height: 48, style: { fontSize: 24, color: '#6b7380' }, text: 'Built in Frame' },
        ],
      },
      {
        id: 'slide-2',
        title: 'Total',
        objects: [
          { id: 'text-3', type: 'text', slideId: 'slide-2', x: 64, y: 48, width: 1152, height: 56, style: { fontSize: 32, fontWeight: 600 }, text: 'Total outlook' },
          { id: 'kpi-1', type: 'kpi', slideId: 'slide-2', x: 64, y: 136, width: 320, height: 120, style: {}, text: 'Total', bindingId: 'binding_kpi' },
          { id: 'chart-1', type: 'chart', slideId: 'slide-2', x: 64, y: 280, width: 1152, height: 392, style: {}, bindingId: 'binding_chart' },
        ],
      },
    ],
    bindings: [
      { id: 'binding_chart', type: 'range-chart', source: { sheetId: 'sheet-model', range: 'A1:A3' }, target: { slideId: 'slide-2', objectId: 'chart-1' } },
      { id: 'binding_kpi', type: 'cell-kpi', source: { sheetId: 'sheet-model', range: 'A3' }, target: { slideId: 'slide-2', objectId: 'kpi-1' } },
    ],
    assets: [],
  }
}
