import { expect, test } from '@playwright/test'
import { chartValues, editCell, freshStart, openSlide } from './helpers'

test.beforeEach(async ({ page }) => {
  await freshStart(page)
  await openSlide(page, 'slide-2')
  await expect(page.getByTestId('slide').getByTestId('kpi-kpi-1')).toHaveText('300')
})

test('editing A2 recalculates A3 and updates the chart without a refresh', async ({ page }) => {
  expect(await chartValues(page)).toEqual([100, 200, 300])
  const latencies: number[] = []
  for (const v of [250, 50, 1000, 200, 7, 640, 333, 90]) {
    latencies.push(await editCell(page, 1, String(v), [100, v, 100 + v]))
    await expect(page.getByTestId('slide').getByTestId('kpi-kpi-1')).toHaveText((100 + v).toLocaleString())
  }
  const sorted = [...latencies].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  console.log(`update latencies (ms): ${latencies.map((l) => l.toFixed(0)).join(', ')} | median ${median.toFixed(0)} | max ${sorted.at(-1)!.toFixed(0)}`)
  // Target is <250 ms perceived. Median is asserted strictly; max gets headroom for noisy headless CI machines.
  expect(median).toBeLessThan(250)
  expect(sorted.at(-1)!).toBeLessThan(400)
})

test('editing A1 (the literal spec case) updates the bound chart', async ({ page }) => {
  await editCell(page, 0, '120', [120, 200, 320])
})

test('makes no network requests outside localhost', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) external.push(r.url())
  })
  await page.reload()
  await openSlide(page, 'slide-2')
  await editCell(page, 1, '1', [100, 1, 101])
  expect(external).toEqual([])
})
