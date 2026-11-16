import { useMemo } from 'react'
import type { BindingValues } from '../../bindings/BindingManager'
import { parseRange } from '../../bindings/range'
import type { Binding } from '../../bindings/types'
import { rangeToChartData } from '../chartData'
import type { SlideObject } from '../types'
import { LinkedChart, type ChartKind } from './LinkedChart'
import { LinkedTable } from './LinkedTable'

interface Props {
  object: SlideObject
  binding?: Binding
  values: BindingValues
}

/** Renders the inside of one slide object. Positioning/selection is the Slide's job. */
export function ObjectView({ object, binding, values }: Props) {
  const data = object.bindingId ? values.get(object.bindingId) : undefined
  const chartData = useMemo(
    () => (object.type === 'chart' && binding && data ? rangeToChartData(data.values, parseRange(binding.source.range)) : null),
    [object.type, binding, data],
  )
  switch (object.type) {
    case 'text':
      return (
        <div className="obj-text" style={object.style as React.CSSProperties}>
          {object.text}
        </div>
      )
    case 'kpi': {
      const text = data?.display[0]?.[0]
      return (
        <div className="obj-kpi">
          <div className="obj-kpi-label">{object.text}</div>
          <div className="obj-kpi-value" data-testid={`kpi-${object.id}`}>{text ? text : '—'}</div>
        </div>
      )
    }
    case 'chart':
      return <LinkedChart data={chartData ?? { labels: [], series: [] }} kind={(object.style.chartType as ChartKind) ?? 'column'} />
    case 'table':
      return <LinkedTable data={data} />
    default:
      return <div className="obj-placeholder">{object.type}</div>
  }
}
