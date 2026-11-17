import { expect, test, type Page } from '@playwright/test'
import { freshStart } from './helpers'

/** The spec's acceptance test (section 22), run against the built-in FY27 Operating Plan demo. */

const kpi = (page: Page, id: string) => page.locator(`[data-testid=slide] [data-testid=kpi-${id}]`)
const display = (page: Page, sheetId: string, range: string) =>
  page.evaluate(([s, r]) => window.__frame!.adapter.getRangeDisplayValues(s, r)[0][0], [sheetId, range] as const)
const rounded = (page: Page, id: string) =>
  page.evaluate((id) => {
    const el = document.querySelector(`[data-testid=slide] [data-testid=object-${id}] [data-testid=linked-chart]`)!
    return (JSON.parse(el.getAttribute('data-values')!) as number[]).map((n) => Math.round(n * 10) / 10)
  }, id)

async function setEnterpriseGrowth(page: Page, text: string) {
  // Assumptions!B4 in the demo's column layout (A is 220px wide, B 100px).
  await expect
    .poll(async () => {
      await page.mouse.click(316, 253)
      return page.evaluate(() => window.__frame!.adapter.getSelection())
    })
    .toEqual({ sheetId: 'sheet-assumptions', range: 'B4' })
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

test('FY27 Operating Plan: an assumption flows through the model to every linked slide, and survives save and reopen', async ({ page }) => {
  await freshStart(page, 'demo')
  await expect(page.getByTestId('project-name')).toHaveValue('FY27 Operating Plan')
  await expect(page.getByRole('tab', { name: 'Assumptions' })).toBeVisible()
  for (const name of ['Revenue', 'Headcount', 'P&L']) await expect(page.getByRole('tab', { name })).toBeAttached()
  await expect.poll(() => display(page, 'sheet-assumptions', 'B4')).toBe('12.0%')

  await page.getByTestId('thumb-slide-revenue').click()
  await expect(kpi(page, 'rev-total')).toHaveText('111.2')
  expect(await rounded(page, 'rev-chart')).toEqual([60, 67.2, 75.3, 40, 44, 48.4])
  await page.getByTestId('thumb-slide-profit').click()
  await expect(kpi(page, 'pnl-ebitda')).toHaveText('18.4')

  // 12% → 8%: no refresh, no export, no copy/paste.
  await setEnterpriseGrowth(page, '8%')
  await expect.poll(() => display(page, 'sheet-assumptions', 'B4')).toBe('8.0%')
  await expect.poll(() => display(page, 'sheet-revenue', 'C4')).toBe('108.8')
  await expect.poll(() => display(page, 'sheet-pnl', 'C7')).toBe('17.0')
  await expect(kpi(page, 'pnl-ebitda')).toHaveText('17.0')
  await expect(kpi(page, 'pnl-margin')).toHaveText('15.6%')
  await expect(page.locator('[data-testid=slide] [data-testid=linked-table]')).toContainText('108.8')
  await page.getByTestId('thumb-slide-revenue').click()
  await expect(kpi(page, 'rev-total')).toHaveText('108.8')
  expect(await rounded(page, 'rev-chart')).toEqual([60, 64.8, 70, 40, 44, 48.4])
  await page.getByTestId('thumb-slide-plan').click()
  await expect(kpi(page, 'plan-ebitda')).toHaveText('17.0')

  // Traceability.
  await page.getByTestId('thumb-slide-revenue').click()
  await page.getByTestId('object-rev-chart').click()
  await expect(page.getByTestId('source')).toHaveText('Revenue!A1:D3')
  await page.getByTestId('goto-source').click()
  expect(await page.evaluate(() => window.__frame!.adapter.getSelection())).toEqual({ sheetId: 'sheet-revenue', range: 'A1:D3' })
  await expect(page.getByRole('tab', { name: 'Revenue' })).toHaveAttribute('aria-selected', 'true')

  // Present shows the updated numbers.
  await page.getByTestId('present-button').click()
  await expect(page.locator('[data-testid=present-slide] [data-testid=kpi-rev-total]')).toHaveText('108.8')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('present')).toHaveCount(0)

  // Save, close, reopen.
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('file-name')).toHaveText('FY27 Operating Plan.frame')
  await page.reload()
  await expect(page.getByTestId('project-name')).toHaveValue('FY27 Operating Plan')
  await expect(page.getByTestId('dirty')).toHaveCount(0)
  await expect.poll(() => display(page, 'sheet-assumptions', 'B4')).toBe('8.0%')

  // A fresh demo is back at 12%; opening the saved file brings back 8%, formulas, formats and links.
  await page.getByTestId('open-demo').click()
  await expect.poll(() => display(page, 'sheet-assumptions', 'B4')).toBe('12.0%')
  await page.evaluate(() => ((window as any).__nextOpenName = 'FY27 Operating Plan.frame'))
  await page.getByTestId('open').click()
  await expect(page.getByTestId('status')).toHaveText('Opened FY27 Operating Plan.frame')
  await expect.poll(() => display(page, 'sheet-assumptions', 'B4')).toBe('8.0%')
  expect(await page.evaluate(() => window.__frame!.adapter.getSheets().map((s) => s.name))).toEqual(['Assumptions', 'Revenue', 'Headcount', 'P&L'])
  expect(await page.evaluate(() => window.__frame!.bindings.list().length)).toBe(12)
  const pnl = await page.evaluate(() => (window.__frame!.adapter.saveSnapshot() as any).sheets['sheet-pnl'].cellData[6][2])
  expect(pnl.f).toBe('=C4+C5+C6')
  await page.getByTestId('thumb-slide-profit').click()
  await expect(kpi(page, 'pnl-ebitda')).toHaveText('17.0')

  // Still live after reopening.
  await page.getByRole('tab', { name: 'Assumptions' }).click()
  await setEnterpriseGrowth(page, '12%')
  await expect(kpi(page, 'pnl-ebitda')).toHaveText('18.4')
})

test('inserting and deleting rows moves linked sources with their cells', async ({ page }) => {
  await freshStart(page, 'demo')
  const range = (id: string) => page.evaluate((id) => window.__frame!.bindings.list().find((b) => b.id === id)!.source.range, id)
  const sheetOp = (op: string) =>
    page.evaluate((op) => {
      const ws = (window.__frame!.adapter as any).api.getActiveWorkbook().getSheetBySheetId('sheet-revenue')
      if (op === 'insert') ws.insertRowsBefore(0, 2)
      else ws.deleteRow(5) // row 6 after the insert: "Total revenue"
    }, op)
  await page.getByTestId('thumb-slide-revenue').click()

  await sheetOp('insert')
  await expect.poll(() => range('binding_rev-chart')).toBe('A3:D5')
  expect(await range('binding_rev-total')).toBe('C6')
  expect(await range('binding_pnl-ebitda')).toBe('C7') // other sheets untouched
  await expect(kpi(page, 'rev-total')).toHaveText('111.2')
  expect(await rounded(page, 'rev-chart')).toEqual([60, 67.2, 75.3, 40, 44, 48.4])
  await expect(page.getByTestId('dirty')).toBeVisible()

  // The model still drives the moved links.
  await page.getByRole('tab', { name: 'Assumptions' }).click()
  await setEnterpriseGrowth(page, '8%')
  await expect(kpi(page, 'rev-total')).toHaveText('108.8')

  // Deleting the total row: its KPI says so instead of showing a neighbour's number.
  await sheetOp('delete')
  await expect.poll(() => range('binding_rev-total')).toBe('#REF!')
  await expect(page.locator('[data-testid=object-rev-total] [data-testid=source-deleted]')).toBeVisible()
  await page.getByTestId('object-rev-total').click()
  await expect(page.getByTestId('source')).toHaveText('Revenue!#REF!')
  await expect(page.getByTestId('goto-source')).toBeDisabled()
  expect(await range('binding_rev-chart')).toBe('A3:D5')
})
