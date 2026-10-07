import { expect, test } from '@playwright/test'
import { canvasChart, chartValues, editCell, freshStart, openSlide } from './helpers'

test.beforeEach(async ({ page }) => freshStart(page))

test('model and presentation are both visible side by side at 1440x900', async ({ page }) => {
  const model = (await page.getByRole('region', { name: 'Model' }).boundingBox())!
  const pres = (await page.getByRole('region', { name: 'Presentation' }).boundingBox())!
  expect(model.width).toBeGreaterThan(600)
  expect(pres.width).toBeGreaterThan(600)
  expect(model.x + model.width).toBeLessThanOrEqual(pres.x + 1)
  for (const name of ['New', 'Open', 'Save', 'Present']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
  await expect(page.getByTestId('project-name')).toHaveValue('Untitled analysis')
  await expect(page.getByRole('tab', { name: 'Model' })).toBeVisible() // Univer's sheet tabs
  await page.screenshot({ path: 'docs/screenshots/shell.png' })
})

test('divider resizes both panes, keeps the sheet usable, and is remembered', async ({ page }) => {
  const model = page.getByRole('region', { name: 'Model' })
  const before = (await model.boundingBox())!.width
  const d = (await page.getByTestId('divider').boundingBox())!
  await page.mouse.move(d.x + d.width / 2, 400)
  await page.mouse.down()
  await page.mouse.move(500, 400, { steps: 8 })
  await page.mouse.up()
  await expect.poll(async () => (await model.boundingBox())!.width).toBeLessThan(before - 150)

  // Univer redraws into the narrower pane and still takes edits that flow to the slide.
  await openSlide(page, 'slide-2')
  await editCell(page, 1, '400', [100, 400, 500])

  // Clamped at the minimum width.
  const d2 = (await page.getByTestId('divider').boundingBox())!
  await page.mouse.move(d2.x + d2.width / 2, 400)
  await page.mouse.down()
  await page.mouse.move(5, 400, { steps: 8 })
  await page.mouse.up()
  expect((await model.boundingBox())!.width).toBeGreaterThanOrEqual(355)

  const narrow = (await model.boundingBox())!.width
  await page.reload()
  await expect.poll(async () => Math.round((await model.boundingBox())!.width)).toBe(Math.round(narrow))

  await page.getByTestId('divider').dblclick()
  await expect.poll(async () => (await model.boundingBox())!.width).toBeGreaterThan(680)
})

test('thumbnails switch slides and stay live', async ({ page }) => {
  await expect(page.getByTestId('thumb-slide-1')).toHaveAttribute('aria-current', 'true')
  await expect(page.getByTestId('objectbar')).toHaveText('Slide 1 of 2')
  await openSlide(page, 'slide-2')
  await expect(page.getByTestId('thumb-slide-2')).toHaveAttribute('aria-current', 'true')
  await expect(page.getByTestId('objectbar')).toHaveText('Slide 2 of 2')
  await expect(canvasChart(page)).toBeVisible()

  // The thumbnail's chart updates too.
  await editCell(page, 0, '150', [150, 200, 350])
  const thumbChart = page.locator('[data-testid=thumb-slide-2] [data-testid=linked-chart]')
  await expect(thumbChart).toHaveAttribute('data-values', '[150,200,350]')
})

test('selecting a linked object shows its source and Go to source selects it', async ({ page }) => {
  await openSlide(page, 'slide-2')
  await page.getByTestId('object-chart-1').click()
  await expect(page.getByTestId('source')).toHaveText('Model!A1:A3')
  await page.getByTestId('goto-source').click()
  expect(await page.evaluate(() => window.__frame!.adapter.getSelection())).toEqual({ sheetId: 'sheet-model', range: 'A1:A3' })

  await page.getByTestId('object-kpi-1').click()
  await expect(page.getByTestId('source')).toHaveText('Model!A3')

  // Clicking empty canvas clears the selection.
  await page.mouse.click(1100, 150)
  await expect(page.getByTestId('objectbar')).toHaveText('Slide 2 of 2')
})

test('Save keeps name, workbook, slides and bindings across a reload; New starts blank', async ({ page }) => {
  await page.getByTestId('project-name').fill('FY27 test')
  await openSlide(page, 'slide-2')
  await editCell(page, 1, '275', [100, 275, 375])
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('status')).toContainText('Saved')

  await page.reload()
  await expect(page.getByTestId('project-name')).toHaveValue('FY27 test')
  await openSlide(page, 'slide-2')
  await expect.poll(() => chartValues(page)).toEqual([100, 275, 375])
  // Formula survived as a formula.
  await editCell(page, 0, '10', [10, 275, 285])

  page.once('dialog', (d) => d.accept())
  await page.getByTestId('new').click()
  await expect(page.getByTestId('project-name')).toHaveValue('Untitled')
  await expect(page.locator('[data-testid^=thumb-]')).toHaveCount(1)
  expect(await page.evaluate(() => window.__frame!.adapter.getSheets())).toEqual([{ id: 'sheet-1', name: 'Sheet1' }])
  expect(await page.evaluate(() => window.__frame!.bindings.list())).toEqual([])
})
