import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test as base, devices, type Page } from '@playwright/test'
import { expectBookScriptsBlocked } from './hostileBook.js'

// Every iPad browser is WebKit, and WebKit never runs listeners the app adds to
// a book frame sandboxed without `allow-scripts`. Chromium does, so only this
// project can catch a regression.
//
// A persistent profile, because an ephemeral WebKit context refuses Blobs in
// IndexedDB (as Private Browsing does) and the sample books never seed.
const test = base.extend<{ page: Page }>({
  page: async ({ playwright, baseURL }, provide) => {
    const dir = await mkdtemp(join(tmpdir(), 'marginalia-ipad-'))
    const { defaultBrowserType: _, ...ipad } = devices['iPad (gen 7)']
    const context = await playwright.webkit.launchPersistentContext(dir, { ...ipad, baseURL })
    // QA must never contact hosted services.
    await context.route(/https:\/\/(?!127\.0\.0\.1)/, (route) => route.abort())
    try {
      await provide(context.pages()[0] ?? (await context.newPage()))
    } finally {
      await context.close()
      await rm(dir, { recursive: true, force: true })
    }
  },
})

async function openChapterOne(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /^Moby Dick/ }).click()
  await page.getByRole('button', { name: 'Table of contents' }).click()
  const contents = page.getByRole('dialog', { name: 'Table of contents' })
  await contents.getByRole('button', { name: /Loomings/i }).click()
  await expect(contents).not.toBeVisible()
  await expect(page.frameLocator('.epub-view iframe').first().locator('body')).toContainText(
    'Call me Ishmael',
  )
  // Images and layout settle after the first paint.
  await page.waitForTimeout(1500)
  return (await page.locator('.epub-container').boundingBox())!
}

// What the long press needs of the frame; QA code is typed without the DOM lib.
interface BookFrame {
  contentDocument: {
    body: EventTarget
    elementFromPoint(x: number, y: number): EventTarget | null
    getSelection(): { toString(): string } | null
  } | null
  getBoundingClientRect(): { left: number; top: number }
}

const scrollLeft = (page: Page) =>
  page.locator('.epub-container').evaluate((element) => element.scrollLeft)

test('a tap on the book turns the page and toggles the toolbars', async ({ page }) => {
  const box = await openChapterOne(page)
  const y = box.y + box.height / 2

  const start = await scrollLeft(page)
  await page.touchscreen.tap(box.x + box.width * 0.9, y)
  await expect.poll(() => scrollLeft(page)).toBeGreaterThan(start)

  const footer = page.locator('footer')
  await expect(footer).toHaveCSS('opacity', '1')
  await page.touchscreen.tap(box.x + box.width / 2, y)
  await expect(footer).toHaveCSS('opacity', '0')
})

test('a long press selects the word under the finger', async ({ page }) => {
  const box = await openChapterOne(page)
  const frame = page.locator('.epub-view iframe').first()

  // Playwright's touchscreen only taps, and this WebKit build will not construct
  // a TouchEvent with touches, so the press is dispatched by hand. It still has
  // to reach the app's listeners, which is what failed.
  const word = await frame.evaluate(
    async (element, point) => {
      const iframe = element as unknown as BookFrame
      const doc = iframe.contentDocument!
      const frameBox = iframe.getBoundingClientRect()
      const x = point.x - frameBox.left
      const y = point.y - frameBox.top
      const target = doc.elementFromPoint(x, y) ?? doc.body
      const fire = (type: string, touches: object[]) => {
        const event = new Event(type, { bubbles: true, cancelable: true })
        Object.defineProperty(event, 'touches', { value: touches })
        Object.defineProperty(event, 'changedTouches', { value: [{ clientX: x, clientY: y }] })
        target.dispatchEvent(event)
      }
      fire('touchstart', [{ clientX: x, clientY: y }])
      await new Promise((resolve) => setTimeout(resolve, 900))
      fire('touchend', [])
      return doc.getSelection()?.toString() ?? ''
    },
    { x: box.x + box.width / 2, y: box.y + box.height * 0.4 },
  )

  expect(word.trim()).not.toBe('')
  await expect(page.getByRole('toolbar', { name: 'Selection actions' })).toBeVisible()
})

test("a book's own scripts never run", async ({ page }) => {
  await expectBookScriptsBlocked(page)
})
