import { describe, expect, it } from 'vitest'
import { installOffer, isIos, SNOOZE_MS, type InstallContext } from './install'

const CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'

const context = (overrides: Partial<InstallContext>): InstallContext => ({
  standalone: false,
  hasPrompt: false,
  userAgent: CHROME,
  maxTouchPoints: 0,
  now: 1_000_000_000_000,
  ...overrides,
})

describe('installOffer', () => {
  it('offers the browser prompt once Chromium hands one over', () => {
    expect(installOffer(context({ hasPrompt: true }))).toBe('prompt')
    expect(installOffer(context({}))).toBeUndefined()
  })

  it('gives iOS instructions, which has no install event', () => {
    expect(installOffer(context({ userAgent: IPHONE, maxTouchPoints: 5 }))).toBe('ios')
  })

  it('stays away once installed', () => {
    expect(installOffer(context({ standalone: true, hasPrompt: true }))).toBeUndefined()
    expect(installOffer(context({ standalone: true, userAgent: IPHONE }))).toBeUndefined()
  })

  it('waits a month after "Not now"', () => {
    const now = 1_000_000_000_000
    expect(installOffer(context({ hasPrompt: true, dismissedAt: now - 1000 }))).toBeUndefined()
    expect(installOffer(context({ hasPrompt: true, dismissedAt: now - SNOOZE_MS }))).toBe('prompt')
  })
})

describe('isIos', () => {
  it('tells an iPad posing as a Mac from a real Mac by touch', () => {
    expect(isIos(MAC, 5)).toBe(true)
    expect(isIos(MAC, 0)).toBe(false)
    expect(isIos(CHROME, 5)).toBe(false)
  })
})
