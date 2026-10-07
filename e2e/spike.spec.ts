import { expect, test, type Page } from '@playwright/test'

// Cell centres in the default Univer grid at 1440x900 (header 46px wide, rows 24px from y=165).
const cell = (row: number) => ({ x: 90, y: 177 + row * 24 })

const chartValues = async (page: Page) => JSON.parse((await page.getByTestId('linked-chart').getAttribute('data-values'))!)

/**
 * Types into a column-A cell and commits with Enter. Returns ms from the Enter keystroke until the chart's
 * data equals `expected` and a frame has been painted (the edit + formula recalculation + rerender).
 */
async function editCell(page: Page, row: number, text: string, expected?: number[]) {
  // Univer's canvas accepts input slightly after first paint; click until the cell is really selected.
  await expect
    .poll(async () => {
      await page.mouse.click(cell(row).x, cell(row).y)
      return page.evaluate(() => window.__frame?.adapter.getSelection()?.range)
    })
    .toBe(`A${row + 1}`)
  await page.keyboard.type(text)
  await page.evaluate((expected) => {
    const el = document.querySelector('[data-testid=linked-chart]')!
    const w = window as any
    const want = expected ? JSON.stringify(expected) : null
    const before = el.getAttribute('data-values')
    w.__t0 = performance.now()
    w.__latency = null
    new MutationObserver((_, obs) => {
      const now = el.getAttribute('data-values')
      if (want ? now === want : now !== before) {
        requestAnimationFrame(() => (w.__latency = performance.now() - w.__t0))
        obs.disconnect()
      }
    }).observe(el, { attributes: true })
  }, expected)
  await page.keyboard.press('Enter')
  await expect.poll(() => page.evaluate(() => (window as any).__latency)).not.toBeNull()
  return page.evaluate(() => (window as any).__latency as number)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByTestId('kpi')).toContainText('300')
})

test('editing A2 recalculates A3 and updates the chart without a refresh', async ({ page }) => {
  expect(await chartValues(page)).toEqual([100, 200, 300])
  const latencies: number[] = []
  for (const v of [250, 50, 1000, 200, 7, 640, 333, 90]) {
    latencies.push(await editCell(page, 1, String(v), [100, v, 100 + v]))
    expect(await chartValues(page)).toEqual([100, v, 100 + v])
    await expect(page.getByTestId('kpi')).toContainText((100 + v).toLocaleString())
  }
  const sorted = [...latencies].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  console.log(`update latencies (ms): ${latencies.map((l) => l.toFixed(0)).join(', ')} | median ${median.toFixed(0)} | max ${sorted.at(-1)!.toFixed(0)}`)
  // Target is <250 ms perceived. Median is asserted strictly; max gets headroom for noisy headless CI machines.
  expect(median).toBeLessThan(250)
  expect(sorted.at(-1)!).toBeLessThan(400)
  await page.screenshot({ path: 'docs/screenshots/after-edit.png' })
})

test('editing A1 (the literal spec case) updates the bound chart', async ({ page }) => {
  await editCell(page, 0, '120', [120, 200, 320])
  expect(await chartValues(page)).toEqual([120, 200, 320])
})

test('snapshot save + in-app reload + full page reload keep values, formulas and bindings', async ({ page }) => {
  await editCell(page, 1, '275', [100, 275, 375])
  await page.getByTestId('save').click()
  await expect(page.getByTestId('status')).toContainText('Saved')

  // Change after saving, then reload snapshot: should revert to saved state.
  await editCell(page, 1, '999', [100, 999, 1099])
  expect(await chartValues(page)).toEqual([100, 999, 1099])
  await page.getByTestId('reload').click()
  await expect.poll(() => chartValues(page)).toEqual([100, 275, 375])

  // Formula survived (not flattened to a value): editing A1 must still recalc A3.
  await editCell(page, 0, '10', [10, 275, 285])
  expect(await chartValues(page)).toEqual([10, 275, 285])

  // Full page reload from the earlier save.
  await page.reload()
  await expect.poll(() => chartValues(page)).toEqual([100, 275, 375])
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('frame.spike.project')!))
  const a3 = saved.workbook.sheets['sheet-model'].cellData[2][0]
  expect(a3.f).toBe('=SUM(A1:A2)')
  expect(saved.bindings.map((b: any) => b.id).sort()).toEqual(['binding_chart', 'binding_kpi'])
  await editCell(page, 1, '5', [100, 5, 105])
  expect(await chartValues(page)).toEqual([100, 5, 105])
})

test('Go to source selects the bound range', async ({ page }) => {
  await page.mouse.click(400, 500) // somewhere else
  await page.getByTestId('goto-source').click()
  const sel = await page.evaluate(() => window.__frame!.adapter.getSelection())
  expect(sel).toEqual({ sheetId: 'sheet-model', range: 'A1:A3' })
  await page.screenshot({ path: 'docs/screenshots/goto-source.png' })
})

test('makes no network requests outside localhost', async ({ page }) => {
  const external: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost')) external.push(r.url())
  })
  await page.reload()
  await expect(page.getByTestId('kpi')).toContainText('300')
  await editCell(page, 1, '1', [100, 1, 101])
  expect(external).toEqual([])
})
