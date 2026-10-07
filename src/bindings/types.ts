export type BindingType = 'cell-kpi' | 'range-table' | 'range-chart'

export interface Binding {
  id: string
  type: BindingType
  source: { sheetId: string; range: string }
  target: { slideId: string; objectId: string }
}
