import type { CellValue } from '../spreadsheet/SpreadsheetAdapter'

/**
 * Infers how the sheet formats a range's numbers (percent, currency prefix, decimals, thousands
 * separators) from one cell's raw value and its displayed text, so charts label values the same way
 * the model shows them. Falls back to plain grouped numbers.
 */
export function inferNumberFormat(values: CellValue[][], display: string[][]): (n: number) => string {
  let sample: string | null = null
  outer: for (let r = 0; r < values.length; r++)
    for (let c = 0; c < (values[r]?.length ?? 0); c++) {
      const d = display[r]?.[c]
      if (typeof values[r][c] === 'number' && d && /\d/.test(d)) {
        sample = d.trim()
        break outer
      }
    }
  const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
  if (!sample) return (n) => plain.format(n)

  const percent = sample.endsWith('%')
  const prefix = /^[^\d\-(.]*/.exec(sample.replace(/^-/, ''))?.[0].trim() ?? ''
  const core = sample.replace(/[^\d.,]/g, '')
  const decimals = core.includes('.') ? core.length - core.lastIndexOf('.') - 1 : 0
  const fmt = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: core.includes(',') || !percent,
  })
  return (n) => {
    const v = percent ? n * 100 : n
    const s = fmt.format(Math.abs(v))
    return `${v < 0 ? '-' : ''}${prefix}${s}${percent ? '%' : ''}`
  }
}
