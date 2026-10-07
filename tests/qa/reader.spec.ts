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

test('an unconfigured relay fails safely', async ({ request }) => {
  const response = await request.post('/api/chat', {
    data: { messages: [{ role: 'user', content: 'Synthetic fixture' }] },
  })
  expect(response.status()).toBe(503)
  expect(JSON.stringify(await response.json())).not.toContain('apiKey')
})
