import type { Binding } from '../bindings/types'
import type { Slide, SlideObject } from '../presentation/types'
import { FRAME_PROJECT_VERSION, type FrameProject } from '../project/FrameProject'

/**
 * The built-in demo: a small but complete operating plan. Every number on the slides is linked to
 * the model, and every model number traces back to the Assumptions sheet, so changing one input
 * (Enterprise growth 12% → 8%) visibly moves revenue, the P&L, EBITDA and the slides.
 */

type Cell = { v?: string | number; f?: string; s?: Record<string, unknown> }

const MONEY = '#,##0.0;(#,##0.0)'
const PCT = '0.0%'
const INT = '#,##0'
const INPUT = { cl: { rgb: '#1a4fd6' }, bg: { rgb: '#eef3ff' } }
const HEADER = { bl: 1, bg: { rgb: '#f3f4f6' }, bd: { b: { s: 1, cl: { rgb: '#9aa1ac' } } } }
const TOTAL = { bl: 1, bd: { t: { s: 1, cl: { rgb: '#9aa1ac' } } } }

const YEARS = ['FY26', 'FY27', 'FY28']
const COLS = ['B', 'C', 'D']

const header = (title: string): Record<number, Cell> => ({
  0: { v: title, s: HEADER },
  ...Object.fromEntries(YEARS.map((y, i) => [i + 1, { v: y, s: { ...HEADER, ht: 3 } }])),
})

/** A model row: a label, then one formula per year built from the column letter (B, C, D). */
const row = (label: string, formula: (col: string, prev: string | null) => string, pattern: string, style: Record<string, unknown> = {}) => ({
  0: { v: label, s: style },
  ...Object.fromEntries(COLS.map((c, i) => [i + 1, { f: formula(c, i ? COLS[i - 1] : null), s: { ...style, n: { pattern } } }])),
})

const input = (label: string, value: number, pattern: string, note: string): Record<number, Cell> => ({
  0: { v: label },
  1: { v: value, s: { ...INPUT, n: { pattern } } },
  2: { v: note, s: { cl: { rgb: '#6b7380' }, it: 1 } },
})

function sheet(id: string, name: string, rows: Record<number, Cell>[], widths: number[]) {
  return {
    id,
    name,
    rowCount: 200,
    columnCount: 26,
    cellData: Object.fromEntries(rows.map((r, i) => [i, r])),
    columnData: Object.fromEntries(widths.map((w, i) => [i, { w }])),
  }
}

const workbook = {
  id: 'fy27-operating-plan',
  name: 'FY27 Operating Plan',
  sheetOrder: ['sheet-assumptions', 'sheet-revenue', 'sheet-headcount', 'sheet-pnl'],
  sheets: {
    'sheet-assumptions': sheet(
      'sheet-assumptions',
      'Assumptions',
      [
        { 0: { v: 'Assumption', s: HEADER }, 1: { v: 'Value', s: { ...HEADER, ht: 2 } }, 2: { v: 'Note', s: HEADER } },
        input('FY26 Enterprise revenue ($M)', 60, MONEY, 'Actuals'),
        input('FY26 SMB revenue ($M)', 40, MONEY, 'Actuals'),
        input('Enterprise growth', 0.12, PCT, 'Year-on-year, FY27 and FY28'),
        input('SMB growth', 0.1, PCT, 'Year-on-year, FY27 and FY28'),
        input('Gross margin', 0.72, PCT, 'Share of revenue'),
        input('Other opex (% of revenue)', 0.15, PCT, 'G&A, marketing programs, tools'),
        input('Cost per head ($K)', 180, INT, 'Fully loaded, per year'),
        input('FY26 ending headcount', 220, INT, 'Actuals'),
        input('Net hires FY27', 30, INT, 'Ending headcount change'),
        input('Net hires FY28', 25, INT, 'Ending headcount change'),
      ],
      [220, 100, 240],
    ),
    'sheet-revenue': sheet(
      'sheet-revenue',
      'Revenue',
      [
        header('Revenue ($M)'),
        row('Enterprise', (c, p) => (p ? `=${p}2*(1+Assumptions!$B$4)` : '=Assumptions!B2'), MONEY),
        row('SMB', (c, p) => (p ? `=${p}3*(1+Assumptions!$B$5)` : '=Assumptions!B3'), MONEY),
        row('Total revenue', (c) => `=SUM(${c}2:${c}3)`, MONEY, TOTAL),
        { 0: { v: 'Growth' }, 2: { f: '=C4/B4-1', s: { n: { pattern: PCT } } }, 3: { f: '=D4/C4-1', s: { n: { pattern: PCT } } } },
      ],
      [180, 80, 80, 80],
    ),
    'sheet-headcount': sheet(
      'sheet-headcount',
      'Headcount',
      [
        header('Headcount'),
        row('Ending headcount', (c, p) => (p ? `=${p}2+Assumptions!B${c === 'C' ? 10 : 11}` : '=Assumptions!B9'), INT),
        row('People cost ($M)', (c) => `=${c}2*Assumptions!$B$8/1000`, MONEY),
        row('Revenue / head ($K)', (c) => `=Revenue!${c}4/${c}2*1000`, INT),
      ],
      [180, 80, 80, 80],
    ),
    'sheet-pnl': sheet(
      'sheet-pnl',
      'P&L',
      [
        header('P&L ($M)'),
        row('Revenue', (c) => `=Revenue!${c}4`, MONEY),
        row('Cost of revenue', (c) => `=-${c}2*(1-Assumptions!$B$6)`, MONEY),
        row('Gross profit', (c) => `=${c}2+${c}3`, MONEY, TOTAL),
        row('People cost', (c) => `=-Headcount!${c}3`, MONEY),
        row('Other opex', (c) => `=-${c}2*Assumptions!$B$7`, MONEY),
        row('EBITDA', (c) => `=${c}4+${c}5+${c}6`, MONEY, TOTAL),
        row('EBITDA margin', (c) => `=${c}7/${c}2`, PCT),
      ],
      [180, 80, 80, 80],
    ),
  },
}

const MUTED = '#6b7380'
const title = (slideId: string, id: string, text: string): SlideObject => ({
  id,
  type: 'text',
  slideId,
  x: 64,
  y: 40,
  width: 1152,
  height: 56,
  style: { fontSize: 32, fontWeight: 600 },
  text,
})
const note = (slideId: string, id: string, text: string): SlideObject => ({
  id,
  type: 'text',
  slideId,
  x: 64,
  y: 92,
  width: 1152,
  height: 32,
  style: { fontSize: 16, color: MUTED },
  text,
})

const bindings: Binding[] = []
/** A linked object plus its binding. */
function linked(
  slideId: string,
  id: string,
  type: 'kpi' | 'table' | 'chart',
  sheetId: string,
  range: string,
  box: [number, number, number, number],
  extra: Partial<SlideObject> = {},
): SlideObject {
  const bindingId = `binding_${id}`
  bindings.push({
    id: bindingId,
    type: type === 'kpi' ? 'cell-kpi' : type === 'table' ? 'range-table' : 'range-chart',
    source: { sheetId, range },
    target: { slideId, objectId: id },
  })
  const [x, y, width, height] = box
  return { id, type, slideId, x, y, width, height, style: type === 'chart' ? { chartType: 'column' } : {}, bindingId, ...extra }
}

const slides: Slide[] = [
  {
    id: 'slide-plan',
    title: 'FY27 Operating Plan',
    objects: [
      { id: 'plan-title', type: 'text', slideId: 'slide-plan', x: 64, y: 160, width: 1152, height: 80, style: { fontSize: 56, fontWeight: 600 }, text: 'FY27 Operating Plan' },
      {
        id: 'plan-sub',
        type: 'text',
        slideId: 'slide-plan',
        x: 64,
        y: 248,
        width: 1152,
        height: 40,
        style: { fontSize: 22, color: MUTED },
        text: 'Every number in this deck is live-linked to the model on the left.',
      },
      linked('slide-plan', 'plan-revenue', 'kpi', 'sheet-revenue', 'C4', [64, 400, 340, 150], { text: 'FY27 revenue ($M)' }),
      linked('slide-plan', 'plan-ebitda', 'kpi', 'sheet-pnl', 'C7', [470, 400, 340, 150], { text: 'FY27 EBITDA ($M)' }),
      linked('slide-plan', 'plan-headcount', 'kpi', 'sheet-headcount', 'C2', [876, 400, 340, 150], { text: 'FY27 ending headcount' }),
    ],
  },
  {
    id: 'slide-revenue',
    title: 'Revenue Outlook',
    objects: [
      title('slide-revenue', 'rev-title', 'Revenue Outlook'),
      note('slide-revenue', 'rev-note', 'Enterprise and SMB revenue, $M'),
      linked('slide-revenue', 'rev-chart', 'chart', 'sheet-revenue', 'A1:D3', [64, 144, 760, 520]),
      linked('slide-revenue', 'rev-total', 'kpi', 'sheet-revenue', 'C4', [872, 144, 344, 150], { text: 'FY27 total revenue ($M)' }),
      linked('slide-revenue', 'rev-growth', 'kpi', 'sheet-revenue', 'C5', [872, 318, 344, 150], { text: 'FY27 growth' }),
    ],
  },
  {
    id: 'slide-profit',
    title: 'Profitability',
    objects: [
      title('slide-profit', 'pnl-title', 'Profitability'),
      note('slide-profit', 'pnl-note', 'Summary P&L, $M'),
      linked('slide-profit', 'pnl-table', 'table', 'sheet-pnl', 'A1:D8', [64, 144, 720, 360]),
      linked('slide-profit', 'pnl-ebitda', 'kpi', 'sheet-pnl', 'C7', [872, 144, 344, 150], { text: 'FY27 EBITDA ($M)' }),
      linked('slide-profit', 'pnl-margin', 'kpi', 'sheet-pnl', 'C8', [872, 318, 344, 150], { text: 'FY27 EBITDA margin' }),
    ],
  },
  {
    id: 'slide-headcount',
    title: 'Headcount',
    objects: [
      title('slide-headcount', 'hc-title', 'Headcount'),
      note('slide-headcount', 'hc-note', 'Ending headcount by year'),
      linked('slide-headcount', 'hc-chart', 'chart', 'sheet-headcount', 'A1:D2', [64, 144, 560, 480]),
      linked('slide-headcount', 'hc-table', 'table', 'sheet-headcount', 'A1:D4', [672, 144, 544, 176]),
      linked('slide-headcount', 'hc-per-head', 'kpi', 'sheet-headcount', 'C4', [672, 352, 344, 150], { text: 'FY27 revenue per head ($K)' }),
    ],
  },
]

export const DEMO_NAME = 'FY27 Operating Plan'

/** A fresh copy of the demo (safe to edit; nothing is shared between calls). */
export function createDemoProject(): FrameProject {
  return structuredClone({
    version: FRAME_PROJECT_VERSION,
    metadata: { name: DEMO_NAME },
    workbook,
    slides,
    bindings,
    assets: [],
  })
}
