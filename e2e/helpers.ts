import { expect, type Page } from '@playwright/test'

// Cell centres in Univer's default grid at 1440x900 under Frame's 44px top bar.
export const cell = (row: number) => ({ x: 90, y: 181 + row * 24 })

export const canvasChart = (page: Page) => page.locator('[data-testid=slide] [data-testid=linked-chart]')
export const chartValues = async (page: Page) => JSON.parse((await canvasChart(page).getAttribute('data-values'))!)

export async function freshStart(page: Page) {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByTestId('thumb-slide-2')).toBeVisible()
}

export async function openSlide(page: Page, id: string) {
  await page.getByTestId(`thumb-${id}`).click()
}

/**
 * Types into a column-A cell and commits with Enter. Returns ms from the Enter keystroke until the
 * canvas chart's data equals `expected` and a frame has been painted (edit + recalculation + rerender).
 */
export async function editCell(page: Page, row: number, text: string, expected?: number[]) {
  // Univer's canvas accepts input slightly after first paint, and A1 is selected by default, so first
  // prove clicks land (select C10), then click until the target cell is really selected.
  await expect
    .poll(async () => {
      await page.mouse.click(266, cell(9).y)
      return page.evaluate(() => window.__frame?.adapter.getSelection()?.range)
    })
    .toBe('C10')
  await expect
    .poll(async () => {
      await page.mouse.click(cell(row).x, cell(row).y)
      return page.evaluate(() => window.__frame?.adapter.getSelection()?.range)
    })
    .toBe(`A${row + 1}`)
  await page.keyboard.type(text)
  await page.evaluate((expected) => {
    const el = document.querySelector('[data-testid=slide] [data-testid=linked-chart]')!
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
