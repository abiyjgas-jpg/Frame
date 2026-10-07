import { useEffect, useRef } from 'react'
import { BarController, BarElement, CategoryScale, Chart, LinearScale } from 'chart.js'
import type { CellValue } from '../../spreadsheet/SpreadsheetAdapter'

Chart.register(BarController, BarElement, CategoryScale, LinearScale)

/** Column chart of a single-column or single-row range. Rerenders synchronously on new values. */
export function LinkedChart({ values, labels }: { values: CellValue[][]; labels: string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const chart = useRef<Chart | null>(null)
  const data = values.flat().map((v) => (typeof v === 'number' ? v : Number(v) || 0))

  useEffect(() => {
    chart.current = new Chart(canvas.current!, {
      type: 'bar',
      data: { labels: [], datasets: [{ data: [], backgroundColor: '#2f5d8a', borderRadius: 2, maxBarThickness: 160 }] },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#5b6573', font: { size: 22 } } },
          y: { beginAtZero: true, grid: { color: '#eceef1' }, border: { display: false }, ticks: { color: '#8a929c', font: { size: 20 } } },
        },
      },
    })
    return () => chart.current?.destroy()
  }, [])

  useEffect(() => {
    const c = chart.current
    if (!c) return
    c.data.labels = labels
    c.data.datasets[0].data = data
    c.update('none')
  })

  return (
    <div className="chart-box" data-testid="linked-chart" data-values={JSON.stringify(data)}>
      <canvas ref={canvas} />
    </div>
  )
}
