/** The spike's starting sheet: A1=100, A2=200, A3=SUM(A1:A2). Labels in B for readability only. */
export const SHEET_ID = 'sheet-model'

export const initialWorkbook = {
  id: 'frame-spike-workbook',
  name: 'Spike',
  sheetOrder: [SHEET_ID],
  sheets: {
    [SHEET_ID]: {
      id: SHEET_ID,
      name: 'Model',
      rowCount: 100,
      columnCount: 20,
      cellData: {
        0: { 0: { v: 100 } },
        1: { 0: { v: 200 } },
        2: { 0: { f: '=SUM(A1:A2)' } },
      },
    },
  },
}
