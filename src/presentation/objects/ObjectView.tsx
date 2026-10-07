import type { BindingValues } from '../../bindings/BindingManager'
import { formatRange, parseRange } from '../../bindings/range'
import type { Binding } from '../../bindings/types'
import type { SlideObject } from '../types'
import { LinkedChart } from './LinkedChart'

interface Props {
  object: SlideObject
  binding?: Binding
  values: BindingValues
}

function formatNumber(v: unknown) {
  if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

/** Renders the inside of one slide object. Positioning/selection is the Slide's job. */
export function ObjectView({ object, binding, values }: Props) {
  const data = object.bindingId ? values.get(object.bindingId) : undefined
  switch (object.type) {
    case 'text':
      return (
        <div className="obj-text" style={object.style as React.CSSProperties}>
          {object.text}
        </div>
      )
    case 'kpi':
      return (
        <div className="obj-kpi">
          <div className="obj-kpi-label">{object.text}</div>
          <div className="obj-kpi-value" data-testid={`kpi-${object.id}`}>{formatNumber(data?.[0]?.[0])}</div>
        </div>
      )
    case 'chart': {
      const flat = data ?? []
      const rect = binding ? parseRange(binding.source.range) : null
      const labels = rect
        ? flat.flat().map((_, i) => formatRange({ ...rect, startRow: rect.startRow + i, endRow: rect.startRow + i }))
        : []
      return <LinkedChart values={flat} labels={labels} />
    }
    default:
      return <div className="obj-placeholder">{object.type}</div>
  }
}
