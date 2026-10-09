import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  // QA must never contact hosted services.
  await context.route(/https:\/\/(?!127\.0\.0\.1)/, (route) => route.abort())
})

test('public-domain book renders and survives reopening', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^Moby Dick/ }).click()
  await expect(page.getByRole('button', { name: 'Table of contents' })).toBeVisible()
  await page.getByRole('button', { name: 'Table of contents' }).click()
  const contents = page.getByRole('dialog', { name: 'Table of contents' })
  await contents.getByRole('button', { name: /Loomings/i }).click()
  await expect(contents).not.toBeVisible()
  await expect(page.locator('iframe').first()).toBeVisible()
  await expect(page.frameLocator('iframe').first().locator('body')).toContainText('Call me Ishmael')
  await page.reload()
  await expect(page.frameLocator('iframe').first().locator('body')).toContainText('Call me Ishmael')
})

test('an in-book link lands on the page that holds its target', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^Meditations/ }).click()
  await page.getByRole('button', { name: 'Table of contents' }).click()
  const contents = page.getByRole('dialog', { name: 'Table of contents' })
  await contents.getByRole('button', { name: 'Paragraphs with First Lines' }).click()
  await expect(contents).not.toBeVisible()
  await page.waitForTimeout(2000)

  // A link into another section, on the visible page. The book is one wide
  // strip of columns, so most links in the frame are off screen; Playwright's
  // boxes are in page coordinates, which tells the two apart.
  const width = page.viewportSize()!.width
  const book = page.frameLocator('.epub-view iframe')
  const links = book.locator('a[href*=".xhtml#"]')
  let target: string | undefined
  for (const link of await links.all()) {
    const box = await link.boundingBox()
    if (!box || box.width === 0 || box.x < 0 || box.x + box.width > width) continue
    target = (await link.getAttribute('href'))!.split('#')[1]
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    break
  }
  expect(target, 'a cross-section link on the visible page').toBeDefined()
  await page.waitForTimeout(2000)

  // The target is an empty anchor opening its paragraph; the paragraph's box
  // starts in the column that holds it.
  const paragraph = book.locator(`[id="${target}"]`).locator('xpath=..')
  await expect(paragraph, 'the target section is still on screen').toHaveCount(1)
  const box = (await paragraph.boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x).toBeLessThan(width)
})

test('an unconfigured relay fails safely', async ({ request }) => {
  const response = await request.post('/api/chat', {
    data: { messages: [{ role: 'user', content: 'Synthetic fixture' }] },
  })
  expect(response.status()).toBe(503)
  expect(JSON.stringify(await response.json())).not.toContain('apiKey')
})
