import { expect, test, type Page } from '@playwright/test'
import { freshStart, openSlide, selectCells, typeInto } from './helpers'

const slide = (page: Page) => page.getByTestId('slide')
const obj = (page: Page, id: string) => page.evaluate((id) => window.__frame!.slides().flatMap((s) => s.objects).find((o) => o.id === id), id)
const slideIds = (page: Page) => page.evaluate(() => window.__frame!.slides().map((s) => s.id))
const newest = (page: Page, type: string) => slide(page).locator(`[data-testid^="object-${type}_"]`).last()
const idOf = async (page: Page, type: string) => (await newest(page, type).getAttribute('data-testid'))!.replace('object-', '')
// 1×1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

test.beforeEach(async ({ page }) => {
  await freshStart(page)
  await openSlide(page, 'slide-2')
})

test('move, resize, nudge and align an object', async ({ page }) => {
  const kpi = slide(page).getByTestId('object-kpi-1')
  const before = (await obj(page, 'kpi-1'))!
  const box = (await kpi.boundingBox())!
  const scale = box.width / before.width

  await page.mouse.move(box.x + 40, box.y + 40)
  await page.mouse.down()
  await page.mouse.move(box.x + 40 + 100 * scale, box.y + 40 + 50 * scale, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await obj(page, 'kpi-1'))!.x).toBeCloseTo(before.x + 100, -1)
  expect((await obj(page, 'kpi-1'))!.y).toBeCloseTo(before.y + 50, -1)

  const h = (await page.getByTestId('handle-se').boundingBox())!
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  await page.mouse.move(h.x + h.width / 2 + 60 * scale, h.y + h.height / 2 + 30 * scale, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await obj(page, 'kpi-1'))!.width).toBeCloseTo(before.width + 60, -1)
  expect((await obj(page, 'kpi-1'))!.height).toBeCloseTo(before.height + 30, -1)

  const x = (await obj(page, 'kpi-1'))!.x
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Shift+ArrowRight')
  await expect.poll(async () => (await obj(page, 'kpi-1'))!.x).toBe(x + 11)

  await page.getByTestId('align-left').click()
  expect((await obj(page, 'kpi-1'))!.x).toBe(64)
  await page.getByTestId('align-center').click()
  const o = (await obj(page, 'kpi-1'))!
  expect(o.x).toBe(Math.round((1280 - o.width) / 2))
})

test('text boxes: insert, type, edit, format, and survive save + reload', async ({ page }) => {
  await page.getByTestId('add-text').click()
  await expect(page.getByTestId('text-editor')).toBeFocused()
  await page.keyboard.type('Revenue grows 15%')
  await page.mouse.click(1100, 760) // click away commits
  const t = newest(page, 'text')
  await expect(t).toHaveText('Revenue grows 15%')

  await t.dblclick()
  await page.keyboard.press('Control+a')
  await page.keyboard.type('Revenue grows 12%')
  await page.keyboard.press('Escape')
  await expect(t).toHaveText('Revenue grows 12%')

  await t.click()
  await page.getByTestId('font-size').selectOption('48')
  await page.getByTestId('bold').click()
  await page.getByTestId('text-align').selectOption('center')
  const id = await idOf(page, 'text')
  expect((await obj(page, id))!.style).toMatchObject({ fontSize: 48, fontWeight: 600, textAlign: 'center' })

  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('status')).toContainText('Saved')
  await page.reload()
  await openSlide(page, 'slide-2')
  await expect(slide(page).getByTestId(`object-${id}`)).toHaveText('Revenue grows 12%')
  await expect(slide(page).getByTestId(`object-${id}`).locator('.obj-text')).toHaveCSS('font-size', '48px')
})

test('images: insert from a file and survive save + reload', async ({ page }) => {
  await page.getByTestId('image-input').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG })
  const img = newest(page, 'image').locator('img')
  await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/)
  await page.keyboard.press('Control+s')
  await expect(page.getByTestId('status')).toContainText('Saved')
  await page.reload()
  await openSlide(page, 'slide-2')
  await expect(newest(page, 'image').locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/)
})

test('duplicate a linked object: the copy has its own binding and stays live', async ({ page }) => {
  await slide(page).getByTestId('object-chart-1').click()
  await page.keyboard.press('Control+d')
  const copyId = await idOf(page, 'chart')
  const copy = (await obj(page, copyId))!
  expect(copy.bindingId).toBeTruthy()
  expect(copy.bindingId).not.toBe('binding_chart')
  await typeInto(page, 'A1', '150')
  await expect(slide(page).getByTestId(`object-${copyId}`).getByTestId('linked-chart')).toHaveAttribute('data-values', '[150,200,350]')

  // Deleting the copy leaves the original linked.
  await slide(page).getByTestId(`object-${copyId}`).click()
  await page.keyboard.press('Delete')
  expect(await page.evaluate(() => window.__frame!.bindings.list().map((b) => b.id).sort())).toEqual(['binding_chart', 'binding_kpi'])
})

test('slides: new, duplicate (stays live), reorder, delete, background', async ({ page }) => {
  await page.getByTestId('new-slide').click()
  let ids = await slideIds(page)
  expect(ids).toHaveLength(3)
  expect(ids.slice(0, 2)).toEqual(['slide-1', 'slide-2'])
  await expect(page.getByTestId('objectbar-context')).toHaveText(/^Slide 3 of 3/)

  await openSlide(page, 'slide-2')
  await page.getByTestId('duplicate-slide').click()
  ids = await slideIds(page)
  expect(ids).toHaveLength(4)
  expect(ids[1]).toBe('slide-2')
  const dup = ids[2]
  await typeInto(page, 'A2', '50')
  await expect(page.getByTestId(`thumb-${dup}`).getByTestId('linked-chart')).toHaveAttribute('data-values', '[100,50,150]')
  await expect(slide(page).getByTestId('linked-chart')).toHaveAttribute('data-values', '[100,50,150]')

  // Drag the duplicate to the front.
  await page.getByTestId(`thumb-${dup}`).dragTo(page.getByTestId('thumb-slide-1'))
  expect((await slideIds(page))[0]).toBe(dup)

  await page.getByTestId('slide-background').fill('#f4efe6')
  expect(await page.evaluate((id) => window.__frame!.slides().find((s) => s.id === id)?.background, dup)).toBe('#f4efe6')

  page.once('dialog', (d) => d.accept())
  await page.getByTestId('delete-slide').click()
  expect(await slideIds(page)).not.toContain(dup)
  expect(await page.evaluate(() => window.__frame!.bindings.list().length)).toBe(2) // the copy's bindings went with it
})

test('present mode: starts at the current slide, navigates, stays live, Escape returns', async ({ page }) => {
  await page.getByTestId('present-button').click()
  const present = page.getByTestId('present')
  await expect(present).toBeVisible()
  await expect(page.getByTestId('present-counter')).toHaveText('2 / 2')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByTestId('present-counter')).toHaveText('1 / 2')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight') // stays on the last slide
  await expect(page.getByTestId('present-counter')).toHaveText('2 / 2')

  // The model changes underneath (e.g. edited on another screen): the slide follows.
  await page.evaluate(() => (window.__frame!.adapter as any).api.getActiveWorkbook().getActiveSheet().getRange('A2').setValue(500))
  await expect(page.getByTestId('present-slide').getByTestId('linked-chart')).toHaveAttribute('data-values', '[100,500,600]')
  await page.screenshot({ path: 'docs/screenshots/present.png' })

  await page.keyboard.press('Escape')
  await expect(present).toHaveCount(0)
  await expect(page.getByTestId('thumb-slide-2')).toHaveAttribute('aria-current', 'true')
})

test('Add to Presentation still works on a new blank slide', async ({ page }) => {
  await page.getByTestId('new-slide').click()
  await selectCells(page, 'C1', 'F4')
  await page.getByTestId('add-chart').click()
  await expect(newest(page, 'chart').getByTestId('linked-chart')).toHaveAttribute('data-values', '[60,70,82,40,45,49,100,115,131]')
  const o = (await obj(page, await idOf(page, 'chart')))!
  expect(o).toMatchObject({ x: 64, y: 136, width: 760, height: 420 })
})
