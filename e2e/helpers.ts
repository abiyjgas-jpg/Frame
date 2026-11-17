import { expect, type Page } from '@playwright/test'

// Cell centres in Univer's default grid at 1440x900 under Frame's 44px top bar.
export const cell = (row: number) => ({ x: 90, y: 181 + row * 24 })
const COL_X = [90, 178, 266, 354, 442, 530, 618]
/** Centre of an A1 cell (columns A–G, rows 1–29) in the grid at its default scroll position. */
export const at = (a1: string) => ({ x: COL_X[a1.charCodeAt(0) - 65], y: 181 + (Number(a1.slice(1)) - 1) * 24 })

/** Selects a range by dragging in the sheet, retrying until Univer reports exactly that selection. */
export async function selectCells(page: Page, from: string, to = from) {
  await expect
    .poll(async () => {
      const a = at(from)
      const b = at(to)
      await page.mouse.move(a.x, a.y)
      await page.mouse.down()
      await page.mouse.move(b.x, b.y, { steps: 4 })
      await page.mouse.up()
      return page.evaluate(() => window.__frame?.adapter.getSelection()?.range)
    })
    .toBe(from === to ? from : `${from}:${to}`)
}

/** Types a value into any cell (A–G) and commits it. */
export async function typeInto(page: Page, a1: string, text: string) {
  await selectCells(page, 'G20') // prove clicks land before targeting
  await selectCells(page, a1)
  await page.keyboard.type(text)
  await page.keyboard.press('Enter')
}

export const canvasChart = (page: Page) => page.locator('[data-testid=slide] [data-testid=linked-chart]')
export const chartValues = async (page: Page) => JSON.parse((await canvasChart(page).getAttribute('data-values'))!)

/**
 * Stands in for the File System Access pickers (which Playwright can't drive) with an in-memory
 * "disk" kept in sessionStorage, so files survive reloads within a test. Tests can steer it with
 * window.__nextSaveName / __nextOpenName and read window.__pickerCalls; deleting
 * window.showSaveFilePicker / showOpenFilePicker switches the app to its download/upload fallback.
 */
function installFakeDisk() {
  const w = window as any
  w.__pickerCalls = 0
  const read = (n: string) => sessionStorage.getItem('disk:' + n)
  const handle = (name: string) => ({
    name,
    async createWritable() {
      let buf = ''
      return { write: async (d: string) => void (buf += d), close: async () => sessionStorage.setItem('disk:' + name, buf) }
    },
    async getFile() {
      return { name, text: async () => read(name) ?? '' }
    },
  })
  w.__readFile = read
  w.showSaveFilePicker = async (o: { suggestedName: string }) => {
    w.__pickerCalls++
    const name = w.__nextSaveName ?? o.suggestedName
    w.__nextSaveName = undefined
    return handle(name)
  }
  w.showOpenFilePicker = async () => {
    const name = w.__nextOpenName
    w.__nextOpenName = undefined
    if (!name) throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
    return [handle(name)]
  }
}

const withDisk = new WeakSet<Page>()

export async function freshStart(page: Page) {
  if (!withDisk.has(page)) {
    withDisk.add(page)
    await page.addInitScript(installFakeDisk)
  }
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.getByTestId('thumb-slide-2')).toBeVisible()
  // Univer finishes mounting (and takes keyboard focus) a moment after first paint; wait until it
  // accepts a click so later focus-sensitive steps aren't raced.
  await selectCells(page, 'G20')
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
