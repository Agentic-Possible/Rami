import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.js'

test.beforeEach(async ({ context }) => {
  // QA must never contact hosted services.
  await context.route(/https:\/\/(?!127\.0\.0\.1)/, (route) => route.abort())
})

// What the stand-in event needs of the page; QA code is typed without the DOM lib.
type PageGlobal = typeof globalThis & { prompted?: boolean; dispatchEvent(event: Event): void }

// Chromium only fires beforeinstallprompt for an installable production build,
// so the test hands over a stand-in and records whether the app used it.
async function offerInstall(page: Page) {
  await page.evaluate(() => {
    const page = globalThis as PageGlobal
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {
        page.prompted = true
      },
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    })
    page.dispatchEvent(event)
  })
}

test('the library offers to install and uses the browser prompt', async ({ page }) => {
  await page.goto('/')
  const banner = page.getByRole('complementary', { name: 'Install Rami' })
  await expect(page.getByRole('button', { name: /^Moby Dick/ })).toBeVisible()
  await expect(banner).toHaveCount(0)

  await offerInstall(page)
  await expect(banner).toContainText('Keep Rami on your home screen')
  await banner.getByRole('button', { name: 'Install' }).click()
  await expect(banner).toHaveCount(0)
  expect(await page.evaluate(() => (globalThis as PageGlobal).prompted)).toBe(true)
})

test('“Not now” keeps the offer away after a reload', async ({ page }) => {
  await page.goto('/')
  await offerInstall(page)
  const banner = page.getByRole('complementary', { name: 'Install Rami' })
  await banner.getByRole('button', { name: 'Not now' }).click()
  await expect(banner).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole('button', { name: /^Moby Dick/ })).toBeVisible()
  await offerInstall(page)
  await page.waitForTimeout(300)
  await expect(banner).toHaveCount(0)
})
