// Prints the browsers a browser-canary leg ran, as a GitHub step output.
import { readFile } from 'node:fs/promises'
import { chromium, firefox, webkit } from '@playwright/test'

async function version(browserType, options) {
  const browser = await browserType.launch(options)
  try {
    return browser.version()
  } finally {
    await browser.close()
  }
}

const channel = process.env.QA_CHANNEL
let browsers
if (channel) {
  browsers = `${channel} ${await version(chromium, { channel })}`
} else {
  const { version: playwright } = JSON.parse(
    await readFile('node_modules/@playwright/test/package.json', 'utf8'),
  )
  browsers = [
    `Playwright ${playwright}`,
    `Chromium ${await version(chromium)}`,
    `Firefox ${await version(firefox)}`,
    `WebKit ${await version(webkit)}`,
  ].join(', ')
}
console.log(`browser=${browsers}`)
