import type { ResolvedRange } from '../../bindings/BindingManager'
import { detectHeaders } from '../chartData'

/** A sheet range as a presentation table: the sheet's own number formats, header row and label column emphasised. */
export function LinkedTable({ data }: { data: ResolvedRange | undefined }) {
  if (!data || !data.display.length) return <div className="obj-placeholder">No data</div>
  const { headerRow, labelCol } = detectHeaders(data.values)
  return (
    <table className="obj-table" data-testid="linked-table">
      <tbody>
        {data.display.map((row, r) => (
          <tr key={r} className={headerRow && r === 0 ? 'is-header' : undefined}>
            {row.map((text, c) => {
              const numeric = typeof data.values[r]?.[c] === 'number' && !(headerRow && r === 0)
              const cls = [numeric ? 'is-num' : '', labelCol && c === 0 ? 'is-label' : ''].join(' ').trim()
              return (
                <td key={c} className={cls || undefined}>
                  {text}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
