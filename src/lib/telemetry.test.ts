// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js/dist/module.slim'

vi.mock('@sentry/react', () => ({ init: vi.fn(), globalHandlersIntegration: vi.fn() }))
vi.mock('posthog-js/dist/module.slim', () => ({ default: { init: vi.fn(), capture: vi.fn() } }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubEnv('VITE_SENTRY_DSN', '')
  vi.stubEnv('VITE_POSTHOG_KEY', '')
  vi.stubEnv('VITE_POSTHOG_HOST', '')
})

describe('telemetry consent', () => {
  it('never initializes SDKs without explicit consent', async () => {
    vi.stubEnv('VITE_SENTRY_DSN', 'https://synthetic.invalid')
    const { startTelemetry, telemetryConsent } = await import('./telemetry')
    expect(telemetryConsent()).toBe(false)
    await startTelemetry()
    expect(Sentry.init).not.toHaveBeenCalled()
    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('stays disabled without SDK configuration even after consent', async () => {
    localStorage.setItem('marginalia.telemetry-consent', 'yes')
    const { startTelemetry } = await import('./telemetry')
    await startTelemetry()
    expect(Sentry.init).not.toHaveBeenCalled()
    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('initializes configured SDKs once and disables automatic content collection', async () => {
    localStorage.setItem('marginalia.telemetry-consent', 'yes')
    vi.stubEnv('VITE_SENTRY_DSN', 'https://synthetic.invalid')
    vi.stubEnv('VITE_POSTHOG_KEY', 'synthetic')
    vi.stubEnv('VITE_POSTHOG_HOST', 'https://synthetic.invalid')
    const { startTelemetry } = await import('./telemetry')
    await startTelemetry()
    await startTelemetry()
    expect(Sentry.init).toHaveBeenCalledOnce()
    expect(posthog.init).toHaveBeenCalledWith(
      'synthetic',
      expect.objectContaining({
        autocapture: false,
        disable_session_recording: true,
        capture_pageview: false,
        capture_pageleave: false,
        person_profiles: 'never',
        persistence: 'memory',
      }),
    )
    expect(posthog.capture).toHaveBeenCalledWith('app_opened')
    const filter = vi.mocked(posthog.init).mock.calls[0][1]?.before_send
    if (typeof filter !== 'function') throw new Error('Missing privacy allowlist')
    const safe = filter({
      uuid: 'synthetic-event-id',
      event: 'app_opened',
      properties: {
        distinct_id: 'synthetic-id',
        $current_url: 'https://private.invalid/?signature=secret',
        book: 'private text',
      },
    })
    expect(safe?.properties).toEqual({ distinct_id: 'synthetic-id' })
    expect(filter({ uuid: 'synthetic-event-id', event: '$pageview', properties: {} })).toBeNull()
  })

  it('fails closed when browser storage is unavailable', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { telemetryConsent } = await import('./telemetry')
    expect(telemetryConsent()).toBe(false)
    spy.mockRestore()
  })
})
