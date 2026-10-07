const CONSENT_KEY = 'marginalia.telemetry-consent'
let active = false
let posthogClient: typeof import('posthog-js/dist/module.slim').default | undefined

export function telemetryConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'yes'
  } catch {
    return false
  }
}

export async function startTelemetry(): Promise<void> {
  if (active || !telemetryConsent()) return
  active = true
  if (import.meta.env.VITE_SENTRY_DSN) {
    const { initializeErrors } = await import('./errorTelemetry')
    initializeErrors(import.meta.env.VITE_SENTRY_DSN)
  }
  if (import.meta.env.VITE_POSTHOG_KEY && import.meta.env.VITE_POSTHOG_HOST) {
    posthogClient = (await import('posthog-js/dist/module.slim')).default
    posthogClient.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST,
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_external_dependency_loading: true,
      advanced_disable_flags: true,
      person_profiles: 'never',
      persistence: 'memory',
      before_send: (event) => {
        if (!event || !['app_opened', 'settings_opened'].includes(event.event)) return null
        return { ...event, properties: { distinct_id: event.properties.distinct_id } }
      },
    })
    trackEvent('app_opened')
  }
}

export function setTelemetryConsent(enabled: boolean): void {
  localStorage.setItem(CONSENT_KEY, enabled ? 'yes' : 'no')
  // Reload clears SDK instances and volatile identifiers, including pending queues.
  window.location.reload()
}

export function trackEvent(event: 'app_opened' | 'settings_opened'): void {
  if (telemetryConsent() && import.meta.env.VITE_POSTHOG_KEY && import.meta.env.VITE_POSTHOG_HOST)
    posthogClient?.capture(event)
}
