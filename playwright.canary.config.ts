import { defineConfig } from '@playwright/test'
import base from './playwright.config.js'

// Reruns the Chromium projects in a branded Chrome channel (QA_CHANNEL, e.g.
// chrome-beta) so browser regressions surface before they reach stable.
const channel = process.env.QA_CHANNEL ?? 'chrome-beta'

export default defineConfig({
  ...base,
  projects: (base.projects ?? [])
    .filter((project) => project.use?.defaultBrowserType === 'chromium')
    .map((project) => ({
      ...project,
      name: `${project.name}-${channel}`,
      use: { ...project.use, channel },
    })),
})
