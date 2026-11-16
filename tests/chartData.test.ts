import { describe, expect, it } from 'vitest'
import { parseRange } from '../src/bindings/range'
import { detectHeaders, rangeToChartData } from '../src/presentation/chartData'

describe('rangeToChartData', () => {
  it('single column of numbers: one series, cell refs as labels', () => {
    expect(rangeToChartData([[100], [200], [300]], parseRange('A1:A3'))).toEqual({
      labels: ['A1', 'A2', 'A3'],
      series: [{ name: '', data: [100, 200, 300] }],
    })
  })

  it('single column with a header cell names the series', () => {
    expect(rangeToChartData([['Revenue'], [60], [70]], parseRange('B4:B6'))).toEqual({
      labels: ['B5', 'B6'],
      series: [{ name: 'Revenue', data: [60, 70] }],
    })
  })

  it('label column + values column: labels come from the left', () => {
    const d = rangeToChartData([['Enterprise', 60], ['SMB', 40]], parseRange('A2:B3'))
    expect(d).toEqual({ labels: ['Enterprise', 'SMB'], series: [{ name: '', data: [60, 40] }] })
  })

  it('single row with a label: one series named by the label, periods from cell refs', () => {
    const d = rangeToChartData([['Total', 100, 115, 131]], parseRange('A4:D4'))
    expect(d).toEqual({ labels: ['B4', 'C4', 'D4'], series: [{ name: 'Total', data: [100, 115, 131] }] })
  })

  it('the spec model: periods across, line items down, one series per line item', () => {
    const grid = [
      ['', 'FY26', 'FY27', 'FY28'],
      ['Enterprise', 60, 70, 82],
      ['SMB', 40, 45, 49],
      ['Total', 100, 115, 131],
    ]
    expect(rangeToChartData(grid, parseRange('A1:D4'))).toEqual({
      labels: ['FY26', 'FY27', 'FY28'],
      series: [
        { name: 'Enterprise', data: [60, 70, 82] },
        { name: 'SMB', data: [40, 45, 49] },
        { name: 'Total', data: [100, 115, 131] },
      ],
    })
  })

  it('years typed as numbers above a label column are treated as a header', () => {
    const grid = [
      [null, 2026, 2027],
      ['Revenue', 100, 115],
    ]
    expect(rangeToChartData(grid, parseRange('A1:C2'))).toEqual({
      labels: ['2026', '2027'],
      series: [{ name: 'Revenue', data: [100, 115] }],
    })
  })

  it('a numeric block with no labels uses column letters and row numbers', () => {
    const d = rangeToChartData([[1, 2], [3, 4]], parseRange('C5:D6'))
    expect(d).toEqual({ labels: ['C', 'D'], series: [{ name: 'Row 5', data: [1, 2] }, { name: 'Row 6', data: [3, 4] }] })
  })

  it('blanks and text in the body become gaps, numeric strings become numbers', () => {
    const d = rangeToChartData([[1], [null], ['n/a'], ['7']], parseRange('A1:A4'))
    expect(d.series[0].data).toEqual([1, null, null, 7])
  })

  it('empty input', () => {
    expect(rangeToChartData([], parseRange('A1'))).toEqual({ labels: [], series: [] })
  })
})

describe('detectHeaders', () => {
  it('does not mistake a numeric first row for a header', () => {
    expect(detectHeaders([[1, 2], [3, 4]])).toEqual({ headerRow: false, labelCol: false })
  })
})
