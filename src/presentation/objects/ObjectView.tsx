import { useMemo } from 'react'
import type { BindingValues } from '../../bindings/BindingManager'
import { parseRange, REF_ERROR } from '../../bindings/range'
import type { Binding } from '../../bindings/types'
import { rangeToChartData } from '../chartData'
import { inferNumberFormat } from '../numberFormat'
import type { Asset, SlideObject } from '../types'
import { LinkedChart, type ChartKind } from './LinkedChart'
import { LinkedTable } from './LinkedTable'

interface Props {
  object: SlideObject
  binding?: Binding
  values: BindingValues
  assets?: Map<string, Asset>
}

/** Renders the inside of one slide object. Positioning/selection is the Slide's job. */
export function ObjectView({ object, binding, values, assets }: Props) {
  const data = object.bindingId ? values.get(object.bindingId) : undefined
  const chartData = useMemo(
    () => (object.type === 'chart' && binding && data && binding.source.range !== REF_ERROR ? rangeToChartData(data.values, parseRange(binding.source.range)) : null),
    [object.type, binding, data],
  )
  const format = useMemo(() => (object.type === 'chart' && data ? inferNumberFormat(data.values, data.display) : undefined), [object.type, data])
  if (binding?.source.range === REF_ERROR)
    return (
      <div className="obj-placeholder" data-testid="source-deleted">
        The cells this {object.type === 'kpi' ? 'KPI' : object.type} showed were deleted
      </div>
    )
  switch (object.type) {
    case 'text':
      return (
        <div className="obj-text" style={textStyle(object)}>
          {object.text}
        </div>
      )
    case 'image': {
      const asset = object.assetId ? assets?.get(object.assetId) : undefined
      return asset ? <img className="obj-image" src={asset.dataUrl} alt={asset.name} draggable={false} /> : <div className="obj-placeholder">Missing image</div>
    }
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
      return <LinkedChart data={chartData ?? { labels: [], series: [] }} kind={(object.style.chartType as ChartKind) ?? 'column'} format={format} />
    case 'table':
      return <LinkedTable data={data} />
    default:
      return <div className="obj-placeholder">{object.type}</div>
  }
}

/** Text objects keep only the style keys Frame edits, so stored styles can't inject arbitrary CSS. */
export function textStyle(o: SlideObject): React.CSSProperties {
  const s = o.style
  return {
    fontSize: Number(s.fontSize) || 24,
    fontWeight: s.fontWeight === 600 || s.fontWeight === 'bold' ? 600 : 400,
    fontStyle: s.fontStyle === 'italic' ? 'italic' : 'normal',
    color: typeof s.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(s.color) ? s.color : undefined,
    textAlign: s.textAlign === 'center' || s.textAlign === 'right' ? s.textAlign : 'left',
  }
}
