import { expect, test, type Page } from '@playwright/test'
import { freshStart, openSlide, selectCells, typeInto } from './helpers'

const slide = (page: Page) => page.getByTestId('slide')
const newest = (page: Page, type: string) => slide(page).locator(`[data-testid^="object-${type}_"]`).last()

// C1:F4 in the starter model: periods across, line items down, Total = SUM formulas.
const MODEL = [60, 70, 82, 40, 45, 49, 100, 115, 131]

test.beforeEach(async ({ page }) => freshStart(page))

test('Add to Presentation creates live chart, table and KPI from the selection', async ({ page }) => {
  await openSlide(page, 'slide-1')

  await selectCells(page, 'C1', 'F4')
  await expect(page.getByTestId('selection')).toHaveText('Model!C1:F4')
  await expect(page.getByTestId('add-kpi')).toBeDisabled() // a KPI needs one cell
  await page.getByTestId('add-chart').click()
  const chart = newest(page, 'chart')
  await expect(chart).toHaveClass(/is-selected/)
  await expect(page.getByTestId('source')).toHaveText('Model!C1:F4')
  await expect(chart.getByTestId('linked-chart')).toHaveAttribute('data-values', JSON.stringify(MODEL))

  await selectCells(page, 'C1', 'F4')
  await page.getByTestId('add-table').click()
  const table = newest(page, 'table')
  await expect(table.getByTestId('linked-table')).toContainText('Enterprise')

  await selectCells(page, 'E4')
  await expect(page.getByTestId('add-chart')).toBeDisabled() // a chart needs two cells
  await page.getByTestId('add-kpi').click()
  const kpi = newest(page, 'kpi')
  await expect(kpi).toContainText('Total · FY27')
  await expect(kpi.locator('.obj-kpi-value')).toHaveText('115')

  // No new object overlaps another.
  const boxes = await slide(page).locator('.slide-object').evaluateAll((els) =>
    els.map((e) => ({ x: (e as HTMLElement).offsetLeft, y: (e as HTMLElement).offsetTop, w: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight })),
  )
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const [a, b] = [boxes[i], boxes[j]]
      expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `objects ${i} and ${j} overlap`).toBe(false)
    }

  // FY27 Enterprise 70 → 65: formulas recalc and every linked object follows.
  await typeInto(page, 'E2', '65')
  await expect(chart.getByTestId('linked-chart')).toHaveAttribute('data-values', JSON.stringify([60, 65, 82, 40, 45, 49, 100, 110, 131]))
  await expect(table.getByTestId('linked-table')).toContainText('110')
  await expect(kpi.locator('.obj-kpi-value')).toHaveText('110')
  await expect(page.getByTestId('thumb-slide-1').locator('[data-testid=linked-chart]')).toHaveAttribute(
    'data-values',
    JSON.stringify([60, 65, 82, 40, 45, 49, 100, 110, 131]),
  )
  await page.screenshot({ path: 'docs/screenshots/bindings.png' })
})

test('Go to source and reverse highlighting', async ({ page }) => {
  await openSlide(page, 'slide-1')
  await selectCells(page, 'C1', 'F4')
  await page.getByTestId('add-chart').click()
  await selectCells(page, 'E4')
  await page.getByTestId('add-kpi').click()

  // Selecting E2 lights up the chart (reads C1:F4) but not the KPI (reads E4).
  await page.mouse.click(1100, 700) // clear object selection
  await selectCells(page, 'E2')
  await expect(page.getByTestId('linked-count')).toContainText('1 linked object')
  await expect(newest(page, 'chart')).toHaveClass(/is-linked/)
  await expect(newest(page, 'kpi')).not.toHaveClass(/is-linked/)
  await expect(page.getByTestId('thumb-slide-1')).toHaveClass(/is-linked/)
  await expect(page.getByTestId('thumb-slide-2')).not.toHaveClass(/is-linked/)

  // Go to source from the KPI.
  await newest(page, 'kpi').click()
  await page.getByTestId('goto-source').click()
  expect(await page.evaluate(() => window.__frame!.adapter.getSelection())).toEqual({ sheetId: 'sheet-model', range: 'E4' })
})

test('deleting a linked object removes its binding; chart type is kept; all survive save and reload', async ({ page }) => {
  await openSlide(page, 'slide-1')
  await selectCells(page, 'C1', 'F4')
  await page.getByTestId('add-chart').click()
  await page.getByTestId('chart-kind').selectOption('line')
  await selectCells(page, 'C1', 'F4')
  await page.getByTestId('add-table').click()
  const before = await page.evaluate(() => window.__frame!.bindings.list().length)

  await newest(page, 'table').click()
  await page.keyboard.press('Delete')
  await expect(slide(page).locator('[data-testid^="object-table_"]')).toHaveCount(0)
  expect(await page.evaluate(() => window.__frame!.bindings.list().length)).toBe(before - 1)

  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('status')).toContainText('Saved')
  await page.reload()
  await openSlide(page, 'slide-1')
  const chart = newest(page, 'chart')
  await expect(chart.getByTestId('linked-chart')).toHaveAttribute('data-values', JSON.stringify(MODEL))
  await chart.click()
  await expect(page.getByTestId('chart-kind')).toHaveValue('line')
  await expect(page.getByTestId('source')).toHaveText('Model!C1:F4')

  // Still live after reload.
  await typeInto(page, 'D3', '50')
  await expect(chart.getByTestId('linked-chart')).toHaveAttribute('data-values', JSON.stringify([60, 70, 82, 50, 45, 49, 110, 115, 131]))
})

test('Delete in the sheet still clears cells (does not delete slide objects)', async ({ page }) => {
  await openSlide(page, 'slide-2')
  await page.getByTestId('object-chart-1').click()
  await selectCells(page, 'A2')
  await page.keyboard.press('Delete')
  await expect(slide(page).getByTestId('object-chart-1')).toHaveCount(1)
  await expect(slide(page).getByTestId('linked-chart')).toHaveAttribute('data-values', '[100,null,100]') // a blank cell is a gap, not zero
})
