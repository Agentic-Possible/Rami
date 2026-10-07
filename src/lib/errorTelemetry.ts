import { globalHandlersIntegration, init } from '@sentry/react'
import { sanitizeErrorEvent } from '../../shared/telemetry'

/** A narrow lazy entry lets the bundler omit unused tracing and React helpers. */
export function initializeErrors(dsn: string): void {
  init({
    dsn,
    defaultIntegrations: false,
    integrations: [globalHandlersIntegration()],
    tracesSampleRate: 0,
    beforeSend: sanitizeErrorEvent,
  })
}
