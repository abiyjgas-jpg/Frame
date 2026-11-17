import { useEffect, useRef } from 'react'
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
} from 'chart.js'
import type { Plugin } from 'chart.js'
import type { ChartData } from '../chartData'

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Legend)

export type ChartKind = 'column' | 'bar' | 'line'

/** Restrained series palette: navy first, then muted complements. */
export const SERIES_COLORS = ['#2f5d8a', '#86a9c9', '#c47f3b', '#5f8f6b', '#8a6fa8', '#9aa3ad']

const TICK = { color: '#5b6573', font: { size: 20 } }
const MAX_LABELLED_POINTS = 24

type FrameChart = Chart & { $frameFormat?: (n: number) => string }

/** Value labels above bars / points, in the sheet's number format. Skipped when the chart is dense. */
const valueLabels: Plugin = {
  id: 'frameValueLabels',
  afterDatasetsDraw(chart) {
    const fmt = (chart as FrameChart).$frameFormat
    const datasets = chart.data.datasets
    const points = datasets.reduce((n, d) => n + d.data.length, 0)
    if (!fmt || points > MAX_LABELLED_POINTS) return
    const horizontal = chart.options.indexAxis === 'y'
    const { ctx } = chart
    ctx.save()
    ctx.font = '500 17px Inter, -apple-system, "Segoe UI", system-ui, sans-serif'
    ctx.fillStyle = '#3b4452'
    datasets.forEach((d, di) => {
      const meta = chart.getDatasetMeta(di)
      if (meta.hidden) return
      meta.data.forEach((el, i) => {
        const v = d.data[i]
        if (typeof v !== 'number') return
        const { x, y } = el.getProps(['x', 'y'], true) as { x: number; y: number }
        if (horizontal) {
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(fmt(v), x + 6, y)
        } else {
          ctx.textAlign = 'center'
          ctx.textBaseline = 'bottom'
          ctx.fillText(fmt(v), x, v < 0 ? y + 22 : y - 6)
        }
      })
    })
    ctx.restore()
  },
}

/** Column, bar or line chart. Rerenders synchronously (no animation) when data changes. */
export function LinkedChart({ data, kind = 'column', format }: { data: ChartData; kind?: ChartKind; format?: (n: number) => string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const chart = useRef<Chart | null>(null)

  useEffect(() => {
    const horizontal = kind === 'bar'
    chart.current = new Chart(canvas.current!, {
      type: kind === 'line' ? 'line' : 'bar',
      data: { labels: [], datasets: [] },
      plugins: [valueLabels],
      options: {
        layout: { padding: { top: 28, right: horizontal ? 64 : 8 } },
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
          legend: { position: 'bottom', align: 'start', labels: { color: '#3b4452', font: { size: 18 }, boxWidth: 16, boxHeight: 16 } },
          tooltip: { enabled: false },
        },
        scales: {
          [horizontal ? 'y' : 'x']: { grid: { display: false }, ticks: TICK },
          [horizontal ? 'x' : 'y']: {
            beginAtZero: true,
            grid: { color: '#eceef1' },
            border: { display: false },
            ticks: { ...TICK, color: '#8a929c', callback: (v) => ((chart.current as FrameChart)?.$frameFormat ?? String)(Number(v)) },
          },
        },
      },
    })
    return () => chart.current?.destroy()
  }, [kind])

  useEffect(() => {
    const c = chart.current
    if (!c) return
    c.data.labels = data.labels
    c.data.datasets = data.series.map((s, i) => {
      const color = SERIES_COLORS[i % SERIES_COLORS.length]
      return kind === 'line'
        ? { label: s.name, data: s.data, borderColor: color, backgroundColor: color, borderWidth: 4, pointRadius: 5, tension: 0 }
        : { label: s.name, data: s.data, backgroundColor: color, borderRadius: 2, maxBarThickness: 160 }
    })
    c.options.plugins!.legend!.display = data.series.length > 1
    ;(c as FrameChart).$frameFormat = format
    c.update('none')
  })

  return (
    <div className="chart-box" data-testid="linked-chart" data-values={JSON.stringify(data.series.map((s) => s.data).flat())}>
      <canvas ref={canvas} />
    </div>
  )
}
