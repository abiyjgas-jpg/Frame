import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { canvasChart, chartValues, editCell, freshStart, openSlide, selectCells, typeInto } from './helpers'

test.beforeEach(async ({ page }) => freshStart(page))

const dirty = (page: Page) => page.getByTestId('dirty')
const pickerCalls = (page: Page) => page.evaluate(() => (window as any).__pickerCalls as number)
const readFile = (page: Page, name: string) => page.evaluate((n) => JSON.parse((window as any).__readFile(n)), name)
/** The Univer cell record (value, formula, style) for a cell, from the live workbook. */
const cellData = (page: Page, sheetId: string, row: number, col: number) =>
  page.evaluate(
    ([s, r, c]) => {
      const wb = window.__frame!.adapter.saveSnapshot() as any
      const cell = wb.sheets[s].cellData[r]?.[c]
      const style = typeof cell?.s === 'string' ? wb.styles[cell.s] : cell?.s
      return { v: cell?.v, f: cell?.f, bold: style?.bl === 1, pattern: style?.n?.pattern }
    },
    [sheetId, row, col] as const,
  )

test('opening the app is clean; selecting and switching slides do not count as changes', async ({ page }) => {
  await selectCells(page, 'A1', 'A3')
  await openSlide(page, 'slide-2')
  await page.getByTestId('object-chart-1').click()
  await expect(dirty(page)).toHaveCount(0)
  await expect(page.getByTestId('file-name')).toHaveText('Not saved to a file')
})

test('Save asks for a file once, then saves in place; Save As asks again', async ({ page }) => {
  await page.getByTestId('project-name').fill('FY27 Plan')
  await expect(dirty(page)).toBeVisible()
  await expect(page).toHaveTitle('• FY27 Plan – Frame')

  await page.getByTestId('save').click()
  await expect(page.getByTestId('status')).toContainText('Saved to FY27 Plan.frame')
  await expect(page.getByTestId('file-name')).toHaveText('FY27 Plan.frame')
  await expect(dirty(page)).toHaveCount(0)
  await expect(page).toHaveTitle('FY27 Plan – Frame')
  expect(await pickerCalls(page)).toBe(1)

  // A sheet edit makes it dirty; Ctrl+S writes the same file without asking.
  await openSlide(page, 'slide-2')
  await editCell(page, 0, '150', [150, 200, 350])
  await expect(dirty(page)).toBeVisible()
  await page.keyboard.press('Control+s')
  await expect(dirty(page)).toHaveCount(0)
  expect(await pickerCalls(page)).toBe(1)
  expect((await readFile(page, 'FY27 Plan.frame')).workbook.sheets['sheet-model'].cellData[0][0].v).toBe(150)

  // Save As writes a second file and switches to it.
  await page.evaluate(() => ((window as any).__nextSaveName = 'FY27 Plan copy.frame'))
  await page.keyboard.press('Control+Shift+S')
  await expect(page.getByTestId('file-name')).toHaveText('FY27 Plan copy.frame')
  expect(await pickerCalls(page)).toBe(2)
})

test('a project survives Save, New and Open: sheets, formulas, formatting, slides, bindings, images', async ({ page }) => {
  await page.getByTestId('project-name').fill('Round trip')

  // Workbook: a value, bold, a number format and a new formula.
  await typeInto(page, 'A2', '250')
  await selectCells(page, 'A3')
  await page.keyboard.press('Control+b')
  await page.evaluate(() => {
    const api = (window.__frame!.adapter as any).api
    api.getActiveWorkbook().getActiveSheet().getRange('A3').setNumberFormat('#,##0.00')
  })
  await typeInto(page, 'B1', '=A3*2')

  // Slides: a text box, an image and a new linked KPI.
  await openSlide(page, 'slide-1')
  await page.getByTestId('add-text').click()
  await page.keyboard.type('Saved text')
  await page.keyboard.press('Escape')
  await page.getByTestId('image-input').setInputFiles({
    name: 'dot.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'),
  })
  await selectCells(page, 'B1')
  await page.getByTestId('add-kpi').click()
  const before = await page.evaluate(() => ({ slides: window.__frame!.slides(), bindings: window.__frame!.bindings.list() }))

  await page.keyboard.press('Control+s')
  await expect(dirty(page)).toHaveCount(0)

  // New wipes the workspace (no prompt: nothing unsaved).
  await page.getByTestId('new').click()
  await expect(page.getByTestId('project-name')).toHaveValue('Untitled')
  await expect(page.getByTestId('file-name')).toHaveText('Not saved to a file')
  expect(await page.evaluate(() => window.__frame!.bindings.list())).toEqual([])

  await page.evaluate(() => ((window as any).__nextOpenName = 'Round trip.frame'))
  await page.getByTestId('open').click()
  await expect(page.getByTestId('status')).toHaveText('Opened Round trip.frame')
  await expect(page.getByTestId('project-name')).toHaveValue('Round trip')
  await expect(dirty(page)).toHaveCount(0)

  const after = await page.evaluate(() => ({ slides: window.__frame!.slides(), bindings: window.__frame!.bindings.list() }))
  expect(after).toEqual(before)
  expect(await page.evaluate(() => window.__frame!.adapter.getSheets())).toEqual([{ id: 'sheet-model', name: 'Model' }])
  expect(await cellData(page, 'sheet-model', 2, 0)).toMatchObject({ v: 350, f: '=SUM(A1:A2)', bold: true, pattern: '#,##0.00' })
  expect(await cellData(page, 'sheet-model', 0, 1)).toMatchObject({ f: '=A3*2' })
  await expect(page.locator('[data-testid=slide] img')).toHaveCount(1)
  await expect(page.locator('[data-testid=slide]').getByText('Saved text')).toBeVisible()
  await expect(page.locator('[data-testid=slide] [data-testid^=kpi-]')).toHaveText('700')

  // Still live: an input flows through both formulas to the chart and the new KPI.
  await openSlide(page, 'slide-2')
  await editCell(page, 0, '50', [50, 250, 300])
  await openSlide(page, 'slide-1')
  await expect(page.locator('[data-testid=slide] [data-testid^=kpi-]')).toHaveText('600')
})

test('without the File System Access API, Save downloads and Open uploads', async ({ page }) => {
  await page.evaluate(() => {
    delete (window as any).showSaveFilePicker
    delete (window as any).showOpenFilePicker
  })
  await openSlide(page, 'slide-2')
  await editCell(page, 1, '275', [100, 275, 375])

  const downloading = page.waitForEvent('download')
  await page.getByTestId('save').click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('Untitled analysis.frame')
  const path = await download.path()
  await expect(dirty(page)).toHaveCount(0)

  page.once('dialog', (d) => d.accept())
  await editCell(page, 1, '1', [100, 1, 101])
  await page.getByTestId('new').click()
  await expect(page.locator('[data-testid^=thumb-]')).toHaveCount(1)

  const choosing = page.waitForEvent('filechooser')
  await page.getByTestId('open').click()
  await (await choosing).setFiles({ name: 'Untitled analysis.frame', mimeType: 'application/json', buffer: readFileSync(path) })
  await expect(page.getByTestId('status')).toHaveText('Opened Untitled analysis.frame')
  await openSlide(page, 'slide-2')
  await expect.poll(() => chartValues(page)).toEqual([100, 275, 375])
})

test('a file that is not a Frame project is refused and the open project is untouched', async ({ page }) => {
  await page.evaluate(() => {
    delete (window as any).showOpenFilePicker
  })
  const message = new Promise<string>((resolve) =>
    page.once('dialog', (d) => {
      resolve(d.message())
      void d.dismiss()
    }),
  )
  const choosing = page.waitForEvent('filechooser')
  await page.getByTestId('open').click()
  await (await choosing).setFiles({ name: 'notes.frame', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') })
  expect(await message).toMatch(/^Couldn't open notes.frame: /)
  await openSlide(page, 'slide-2')
  await expect(canvasChart(page)).toBeVisible()
  expect(await page.evaluate(() => window.__frame!.bindings.list().length)).toBe(2)
})

test('unsaved work comes back after a reload, still marked unsaved; Open asks before discarding it', async ({ page }) => {
  await openSlide(page, 'slide-2')
  await editCell(page, 0, '120', [120, 200, 320])
  await page.getByTestId('project-name').fill('Draft')
  await page.reload()
  await expect(page.getByTestId('project-name')).toHaveValue('Draft')
  await expect(dirty(page)).toBeVisible()
  await openSlide(page, 'slide-2')
  await expect.poll(() => chartValues(page)).toEqual([120, 200, 320])

  // Saving a copy somewhere, then cancelling an Open of it, keeps the current work.
  await page.keyboard.press('Control+s')
  await expect(dirty(page)).toHaveCount(0)
  await page.getByTestId('project-name').fill('Draft 2')
  await page.evaluate(() => ((window as any).__nextOpenName = 'Draft.frame'))
  page.once('dialog', (d) => {
    expect(d.message()).toContain('Unsaved changes')
    void d.dismiss()
  })
  await page.keyboard.press('Control+o')
  await expect(page.getByTestId('project-name')).toHaveValue('Draft 2')
  await expect(dirty(page)).toBeVisible()
})
